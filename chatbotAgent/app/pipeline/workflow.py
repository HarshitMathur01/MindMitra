"""
MindMitra Pipeline Workflow — intent-routed pipeline with mem0 memory.
"""
import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from ..agents.intent_router import IntentRouter
from ..agents.nlp_agent import GroqNLPModule
from ..agents.response_agent import ResponseGenerator
from ..agents.memory_manager import memory_manager
from ..agents.screening_agent import ScreeningAssessmentAgent
from ..controllers.glm_controller import GLMController
from ..core.config import config
from ..pipeline.context import create_empty_user_context
from ..utils.json_utils import parse_json_from_llm_output

logger = logging.getLogger(__name__)


class MindMitraWorkflow:
    """
    Orchestrates the intent-routed pipeline:
      1. Build UserContext JSON
      2. Fetch session memories
      3. Route intent → Path A (casual) / B (emotional) / C (therapeutic) / D (crisis)
      4. Each path runs only the analysis + agents it needs
      5. mem0 memory retrieval injected at route time
      6. Return result
    """

    def __init__(self) -> None:
        logger.info("🧠 [WORKFLOW] Initialising MindMitra v2 (modular architecture)…")

        self.workflow_config = config.get_section("workflow")
        self.feature_flags = config.get_section("features")
        self.max_workers: int = self.workflow_config.get("max_workers", 3)

        # ── Supabase ──────────────────────────────────────────
        supabase_url = config.get_api_key("supabase_url") or os.getenv("SUPABASE_URL", "")
        supabase_key = (
            config.get_api_key("supabase_key")
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            or os.getenv("SUPABASE_KEY", "")
        )

        if supabase_url and supabase_key and self.feature_flags.get("save_to_supabase", True):
            self.supabase: Optional[Client] = create_client(supabase_url, supabase_key)
            logger.info("✅ [WORKFLOW] Supabase client ready")
        else:
            self.supabase = None
            logger.warning("⚠️ [WORKFLOW] Supabase not configured or disabled")

        self._user_contexts_table_available: bool = self.feature_flags.get("user_contexts_table", True)

        # ── Agents & controllers ──────────────────────────────
        self.groq_nlp: Optional[GroqNLPModule] = GroqNLPModule() if self.feature_flags.get("nlp_analysis", True) else None
        self.glm = GLMController()
        self.screening_agent: Optional[ScreeningAssessmentAgent] = (
            ScreeningAssessmentAgent(self.groq_nlp, self.glm) if self.feature_flags.get("screening_assessments", True) else None
        )
        self.response_gen = ResponseGenerator(self.glm)

        # ── Intent router (reuses groq_nlp client — no new API key) ──────────
        if self.groq_nlp and self.groq_nlp.client:
            self.intent_router: Optional[IntentRouter] = IntentRouter(
                groq_client=self.groq_nlp.client,
                model=self.groq_nlp.model,
            )
        else:
            self.intent_router = None
            logger.warning("⚠️ [WORKFLOW] Intent router disabled (Groq client unavailable)")

        self._summarization_cache: Dict = {}
        self._last_summarization_count: Dict = {}

        logger.info("✅ [WORKFLOW] MindMitra v2 fully initialised\n")

    # ── merge helpers ──────────────────────────────────────────────────────
    def _merge_lists(self, old: List, new: List) -> List:
        combined = old + new
        seen: set = set()
        result: List = []
        for item in combined:
            key = json.dumps(item, sort_keys=True)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result

    def _merge_contexts_simple(self, old_ctx: Dict, new_ctx: Dict) -> Dict:
        def _deep(a: Any, b: Any) -> Any:
            if isinstance(a, dict) and isinstance(b, dict):
                merged = {k: deepcopy(v) for k, v in a.items()}
                for k, v in b.items():
                    merged[k] = _deep(merged[k], v) if k in merged else deepcopy(v)
                return merged
            if isinstance(a, list) and isinstance(b, list):
                return self._merge_lists(a, b)
            return deepcopy(b if b is not None else a)
        return _deep(old_ctx, new_ctx)

    # ── supabase helpers ───────────────────────────────────────────────────
    def _resolve_user_id_from_supabase(self, context: Dict) -> Optional[str]:
        if not self.supabase:
            return context.get("user_id")
        session_id = context.get("session_id")
        if not session_id:
            return context.get("user_id")
        try:
            resp = (
                self.supabase.table("chat_messages")
                .select("user_id")
                .eq("session_id", session_id)
                .not_.is_("user_id", "null")
                .limit(1)
                .execute()
            )
            if resp.data:
                return resp.data[0].get("user_id") or context.get("user_id")
        except Exception as e:
            logger.warning(f"⚠️ [FILE] Could not resolve user_id from Supabase: {e}")
        return context.get("user_id")

    def _save_user_context_to_supabase(self, context: Dict) -> None:
        if not self.supabase or not self._user_contexts_table_available:
            return
        try:
            user_id = context.get("user_id")
            if not user_id:
                return
            payload = {
                "user_id": user_id,
                "context": context,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table("user_contexts").upsert(payload, on_conflict="user_id").execute()
            logger.info("✅ [FILE] UserContext saved to Supabase")
        except Exception as e:
            err = str(e).lower()
            if "pgrst205" in err and "user_contexts" in err:
                self._user_contexts_table_available = False
                logger.warning("⚠️ [FILE] 'user_contexts' table missing; disabling upserts")
            else:
                logger.warning(f"⚠️ [FILE] Supabase upsert failed: {e}")

    # ── memory helpers ─────────────────────────────────────────────────────
    def save_user_context_to_file(self, user_context: Dict, file_name: str) -> None:
        try:
            save_dir = "user_contexts"
            os.makedirs(save_dir, exist_ok=True)

            resolved_uid = self._resolve_user_id_from_supabase(user_context)
            if resolved_uid:
                user_context["user_id"] = resolved_uid

            file_path = os.path.join(save_dir, f"user_context_{user_context.get('user_id', 'unknown')}.json")

            def _read_existing() -> Optional[Dict]:
                if not os.path.exists(file_path):
                    return None
                try:
                    with open(file_path, "r") as fh:
                        return json.load(fh)
                except Exception:
                    return None

            with ThreadPoolExecutor(max_workers=1) as executor:
                fut_existing = executor.submit(_read_existing)
                existing_ctx = fut_existing.result()

            # NOTE: Screening is no longer run per-message.
            # PHQ-9/GAD-7 assessment runs at session-end intervals
            # (see chat.py _run_session_end_jobs) for better accuracy.

            merged_ctx = (
                self._merge_contexts_simple(existing_ctx, user_context)
                if existing_ctx is not None else user_context
            )

            with open(file_path, "w") as fh:
                json.dump(merged_ctx, fh, indent=4)

            self._save_user_context_to_supabase(merged_ctx)
            logger.info(f"✅ [FILE] UserContext saved to {file_path}")
        except Exception as e:
            logger.error(f"❌ [FILE] Failed to save user context: {e}")

    # ── core pipeline ──────────────────────────────────────────────────────

    # ── class-level constants ──────────────────────────────────────────────

    # Crisis keywords that trigger immediate fast-path (no LLM needed)
    _CRISIS_HARD_KEYWORDS = (
        "kill myself", "killing myself", "end my life", "ending my life",
        "take my life", "taking my life", "suicidal",
        "want to die", "wanna die", "want to hurt myself", "i want to hurt myself",
        "self harm", "self-harm", "cutting myself", "cut myself",
        "no reason to live", "not worth living", "better off dead",
        "don't want to live", "dont want to live", "shouldn't be alive",
        # Hindi / Hinglish equivalents
        "maar dunga", "maar lunga", "maar lungi", "khatam kar lunga",
        "khatam kar lungi", "khatam ho jaana chahta", "khatam ho jaana chahti",
        "zindagi khatam", "jeena nahi chahta", "jeena nahi chahti",
        "marna chahta", "marna chahti", "khud ko maar",
    )

    # Keywords that may or may not signal crisis — escalate to LLM for disambiguation.
    # NOTE: bare "suicide" is here (not HARD) to avoid false-positives on informational
    # use ("suicide rates", "suicide prevention", etc.).  The LLM check correctly
    # escalates "I'm thinking about suicide" while passing academic/news references.
    _CRISIS_AMBIGUOUS_KEYWORDS = (
        "suicide",
        "hurt myself", "hurt yourself", "hurting myself",
        "end it all", "end it", "can't go on", "cant go on",
        "nobody cares", "worthless", "hopeless", "disappear forever",
    )

    # Hardcoded crisis resources (India-specific) — template-dynamic
    _CRISIS_RESPONSE_TEMPLATES: Dict[str, str] = {
        "english": (
            "Hey, I'm really glad you reached out, and I want you to know "
            "you're not alone right now. What you're feeling is real, and it matters deeply. "
            "{known_support}"
            "Please talk to someone who can really be there for you — "
            "a doctor, counselor, or someone you trust:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "You deserve real support. I'm here too — can you share a little more "
            "about what's been happening?"
        ),
        "hindi": (
            "Hey, mujhe bahut khushi hai ki tumne mujhse baat ki. "
            "Tum akele nahi ho, aur jo tum mehsoos kar rahe ho woh bilkul real hai. "
            "{known_support}"
            "Please kisi se baat karo jo tumhare saath ho sake — "
            "doctor, counselor, ya koi apna:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "Tum real support ke haqdaar ho. Main bhi yahan hoon — "
            "kya thoda aur bata sakte ho ki kya ho raha hai?"
        ),
        "hinglish": (
            "Hey, I'm really glad tumne mujhse baat ki. "
            "You're not alone right now — jo tum feel kar rahe ho woh real hai aur it matters deeply. "
            "{known_support}"
            "Please kisi se baat karo who can really be there for you — "
            "doctor, counselor, ya koi close person:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "You deserve real support. Main bhi hoon — "
            "can you share thoda aur about what's been happening?"
        ),
    }

    @staticmethod
    def _build_voice_hint(voice: Dict) -> Optional[str]:
        """
        Build a concise voice prosody summary for intent routing.
        Returns None if no meaningful voice data available.
        """
        if not voice:
            return None

        parts = []

        # Azure metrics
        wpm = voice.get("speech_rate_wpm")
        if wpm:
            parts.append(f"{wpm} WPM ({voice.get('speech_rate_category', 'normal')})")

        pause = voice.get("pause_pattern")
        if pause and pause != "minimal":
            parts.append(f"pauses: {pause}")

        # Prosodic features (from parselmouth)
        prosody = voice.get("prosody", {})
        if prosody:
            jitter = prosody.get("jitter_local_percent")
            if jitter is not None and jitter > 2.0:
                parts.append(f"voice shakiness: {jitter:.1f}%")

            pitch_std = prosody.get("pitch_std_hz", 0)
            pitch_mean = prosody.get("pitch_mean_hz", 0)
            if pitch_mean > 0 and pitch_std < 15:
                parts.append("monotone voice")
            elif pitch_std > 60:
                parts.append("highly variable pitch")

            hnr = prosody.get("hnr_db")
            if hnr is not None and hnr < 8:
                parts.append("breathy/unclear voice")

        return ", ".join(parts) if parts else None

    def _build_voice_context_block(self, ctx: Dict) -> str:
        """
        Build a voice context block for LLM analysis prompts (Paths B, C).
        Raw metrics only — no emotional labels.
        """
        voice = ctx.get("voice_analysis", {})
        if not voice:
            return ""

        from ..services.voice_prosody import format_prosody_for_prompt

        lines = []

        # Azure speech metrics
        wpm = voice.get("speech_rate_wpm")
        if wpm is not None:
            lines.append(f"Speech rate: {wpm} WPM ({voice.get('speech_rate_category', '')})")
        pause = voice.get("pause_pattern")
        if pause:
            lines.append(f"Pause pattern: {pause} (long pauses: {voice.get('long_pause_count', 0)})")
        ratio = voice.get("speech_to_silence_ratio")
        if ratio is not None:
            lines.append(f"Speech-to-silence ratio: {ratio}")

        # Prosodic features (from parselmouth)
        prosody = voice.get("prosody", {})
        if prosody:
            prosody_text = format_prosody_for_prompt(prosody)
            if prosody_text:
                lines.append(prosody_text)

        if not lines:
            return ""

        return "Voice tone indicators (raw metrics, no interpretation):\n" + "\n".join(lines) + "\n"

    def _build_crisis_response(self, ctx: Dict) -> str:
        """
        Build a personalised crisis response using language preference
        and any known support context from procedural memories.
        """
        lang = ctx.get("personality_settings", {}).get("language", "english")
        template = self._CRISIS_RESPONSE_TEMPLATES.get(
            lang, self._CRISIS_RESPONSE_TEMPLATES["english"]
        )

        # Extract known support from memory context if available
        known_support = ""
        mem_ctx = ctx.get("memory_context", "")
        if mem_ctx and ("coping" in mem_ctx.lower() or "helps" in mem_ctx.lower() or "support" in mem_ctx.lower()):
            known_support = "I remember some things that have helped you before — and I want you to know that strength is still in you. "

        return template.format(known_support=known_support)

    # Technique → 2-line system-prompt directive (pure Python, zero LLM)
    _TECHNIQUE_DIRECTIVES: Dict[str, str] = {
        "validate": (
            "Focus entirely on making this person feel deeply understood. "
            "Do not offer advice or reframes."
        ),
        "reframe": (
            "Gently offer one alternative way to look at this situation. "
            "Don't push — just open a door."
        ),
        "ground": (
            "Naturally bring their attention to the present moment — "
            "their body, breath, or surroundings."
        ),
        "problem-solve": (
            "Help identify one small, concrete next step they can actually take right now."
        ),
        "refer": (
            "Warmly acknowledge this is bigger than a chat can hold. "
            "Gently and compassionately mention professional support."
        ),
        "psychoeducation": (
            "Share one simple, relatable insight about what they're experiencing. "
            "Keep it accessible, not clinical."
        ),
    }

    # ── crisis helpers ─────────────────────────────────────────────────────

    def _check_crisis_keywords(self, text: str) -> str:
        """
        Fast keyword scan. Returns: "hard" | "ambiguous" | "safe".
        pure-Python, zero I/O, ~0 ms.
        """
        tl = text.lower()
        for kw in self._CRISIS_HARD_KEYWORDS:
            if kw in tl:
                logger.warning(f"🚨 [CRISIS-KW] Hard match: '{kw}'")
                return "hard"
        for kw in self._CRISIS_AMBIGUOUS_KEYWORDS:
            if kw in tl:
                logger.info(f"⚠️ [CRISIS-KW] Ambiguous match: '{kw}'")
                return "ambiguous"
        return "safe"

    def _crisis_llm_check(self, text: str) -> bool:
        """
        Lightweight LLM call for ambiguous crisis signals.
        Only called when keyword scan returns "ambiguous".
        Returns True if crisis intent detected.
        """
        if not (self.groq_nlp and self.groq_nlp.client):
            return False
        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self.groq_nlp.model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Does this message express intent to harm oneself or end one's life? "
                        f'Answer only "yes" or "no".\nMessage: "{text[:300]}"'
                    ),
                }],
                temperature=0.0,
                max_tokens=5,
            )
            answer = (resp.choices[0].message.content.strip().lower()) if resp.choices else "no"
            return answer.startswith("yes")
        except Exception as e:
            logger.warning(f"⚠️ [CRISIS-LLM] Check failed: {e}")
            return False

    def _crisis_fast_path(self, ctx: Dict) -> None:
        """
        Path D — immediate empathetic crisis response. Logs event. Under ~1s.
        Sets ctx["ai_response"] directly, sets analysis to crisis defaults.
        """
        logger.critical(
            f"🚨 [CRISIS] Fast-path triggered | session={str(ctx.get('session_id','?'))[:8]}"
        )
        # Log to crisis_events table (non-blocking)
        if self.supabase:
            try:
                # Include voice stress indicators in crisis log for clinical review
                voice = ctx.get("voice_analysis", {})
                prosody = voice.get("prosody", {})
                voice_indicators = {}
                if voice.get("speech_rate_wpm"):
                    voice_indicators["speech_rate_wpm"] = voice["speech_rate_wpm"]
                if prosody.get("jitter_local_percent"):
                    voice_indicators["jitter_percent"] = prosody["jitter_local_percent"]
                if prosody.get("pitch_mean_hz"):
                    voice_indicators["pitch_mean_hz"] = prosody["pitch_mean_hz"]
                    voice_indicators["pitch_std_hz"] = prosody.get("pitch_std_hz", 0)
                if prosody.get("hnr_db"):
                    voice_indicators["hnr_db"] = prosody["hnr_db"]

                crisis_data = {
                    "user_id": ctx.get("user_id", "anonymous"),
                    "level": "high",
                    "source": "intent_router_crisis_path",
                }
                if voice_indicators:
                    crisis_data["voice_indicators"] = voice_indicators  # type: ignore

                self.supabase.table("crisis_events").insert(crisis_data).execute()
            except Exception as e:
                logger.error(f"❌ [CRISIS] Supabase log failed: {e}")

        ctx["ai_response"] = self._build_crisis_response(ctx)
        ctx["response_generated"] = True
        ctx["intervention_directive"] = ""

        # Store crisis memory (background, non-blocking)
        try:
            threading.Thread(
                target=memory_manager.add_crisis_memory,
                args=(
                    ctx.get("user_id", "anonymous"),
                    ctx.get("user_message", ""),
                    ctx.get("session_id"),
                ),
                daemon=True,
            ).start()
        except Exception as crisis_mem_exc:
            logger.error(f"❌ [CRISIS] Memory save failed: {crisis_mem_exc}")

        ctx["psychological_analysis"] = {
            "emotional_state": "crisis",
            "stress_categories": ["Crisis"],
            "risk_assessment": "crisis",
            "coping_assessment": "immediate intervention required",
            "intervention_priority": "immediate",
            "psychological_insights": ["User expressed crisis-level distress"],
            "cultural_pressures": "",
        }
        ctx["technique_selection"] = {
            "primary_technique": "Crisis-Protocol",
            "therapeutic_approach": "refer",
            "activity_recommendations": [],
            "rationale": "immediate safety — crisis fast-path",
        }

    # ── technique directive lookup ─────────────────────────────────────────

    def _technique_directive(self, intervention: str) -> str:
        """Pure Python dict lookup. Zero LLM calls."""
        return self._TECHNIQUE_DIRECTIVES.get(intervention.lower(), self._TECHNIQUE_DIRECTIVES["validate"])

    # ── activity summary for analysis prompts ──────────────────────────────

    @staticmethod
    def _activity_context_block(ctx: Dict, max_items: int = 5) -> str:
        """
        Build a compact activity summary string for injection into analysis prompts.
        Returns empty string if no recent activities.
        """
        activities = ctx.get("session_context", {}).get("user_activities", [])
        if not activities:
            return ""
        lines = []
        for act in activities[:max_items]:
            atype = act.get("activity_type", "?")
            score = act.get("score", "?")
            accuracy = act.get("accuracy_percentage")
            insights = act.get("insights_generated", {})
            perf = insights.get("performance_level", "") if isinstance(insights, dict) else ""
            patterns = insights.get("key_patterns", []) if isinstance(insights, dict) else []
            acc_str = f" acc={accuracy}%" if accuracy is not None else ""
            perf_str = f" perf={perf}" if perf else ""
            pat_str = f" signals={patterns}" if patterns else ""
            lines.append(f"  - {atype}: score={score}{acc_str}{perf_str}{pat_str}")
        return "Recent game/assessment activity (last 24h):\n" + "\n".join(lines)

    # ── combined emotion + cultural analysis (replaces old Prompts 1+2) ───

    def _combined_emotion_cultural_analyse(self, ctx: Dict) -> Dict:
        """
        Path B helper — ONE Groq call replaces old NLP + cultural calls.
        Returns: {primary_emotion, intensity, cultural_pressure, language_style,
                  user_needs, tone_match}
        """
        defaults = {
            "primary_emotion": "neutral",
            "intensity": 0.5,
            "cultural_pressure": "none",
            "language_style": "english",
            "user_needs": "validation",
            "tone_match": "warm",
        }
        if not (self.groq_nlp and self.groq_nlp.client):
            return defaults

        text = ctx.get("user_message", "")
        recent = ctx["session_context"].get("recent_messages", [])[-3:]
        history = " | ".join(
            f"{m.get('role', '?')}: {m.get('content', '')[:100]}" for m in recent
        )
        ctx_line = f"Context: {history[:400]}\n" if history else ""

        act_block = self._activity_context_block(ctx)
        act_line = f"\n{act_block}\n" if act_block else ""

        # Memory context for emotional analysis (fixes memory blind spot in Path B)
        mem0_context = ctx.get("memory_context", "")
        mem_line = f"User history from memory: {mem0_context[:300]}\n" if mem0_context else ""

        # Voice prosody context (raw tone metrics)
        voice_block = self._build_voice_context_block(ctx)
        voice_line = f"\n{voice_block}" if voice_block else ""

        prompt = (
            "Analyse this message for a mental-health chatbot. "
            "Return ONLY valid JSON:\n"
            "{\n"
            '  "primary_emotion": "<strongest emotion>",\n'
            '  "intensity": <float 0-1>,\n'
            '  "cultural_pressure": "<none|exam|family|social|identity|career|stigma>",\n'
            '  "language_style": "<english|hinglish|hindi>",\n'
            '  "user_needs": "<just_to_vent|validation|practical_help|information|company>",\n'
            '  "tone_match": "<playful|warm|gentle|calm|energetic>"\n'
            "}\n\n"
            f"{ctx_line}"
            f"{mem_line}"
            f"{act_line}"
            f"{voice_line}"
            f'Message: "{text[:600]}"\n\nJSON:'
        )
        try:
            _t_groq = time.monotonic()
            logger.debug(f"  📡 [COMBINED-ANALYSIS] Groq API call ({self.groq_nlp.model}) ...")
            resp = self.groq_nlp.client.chat.completions.create(
                model=self.groq_nlp.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=180,
            )
            _groq_ms = (time.monotonic() - _t_groq) * 1000
            raw = (resp.choices[0].message.content.strip()) if resp.choices else ""
            parsed = parse_json_from_llm_output(raw)
            if isinstance(parsed, dict):
                for k, v in defaults.items():
                    if k not in parsed:
                        parsed[k] = v
                logger.info(
                    f"✅ [COMBINED-ANALYSIS] Groq {_groq_ms:.0f}ms | "
                    f"emotion={parsed.get('primary_emotion')} "
                    f"intensity={parsed.get('intensity',0):.2f} "
                    f"lang={parsed.get('language_style')} "
                    f"needs={parsed.get('user_needs')}"
                )
                return parsed
        except Exception as e:
            logger.error(f"❌ [COMBINED-ANALYSIS] Groq call failed: {e}")
        return defaults

    # ── optimised psychological analysis (replaces old Prompt 3 for Path C) ──

    def _optimized_psych_analysis(self, ctx: Dict) -> Dict:
        """
        Path C helper — lighter GLM prompt, ~40% fewer tokens than full analysis.
        Returns: {emotional_state, primary_stressor, risk_level, intervention,
                  insight, cultural_factor}
        """
        defaults = {
            "emotional_state": "distressed",
            "primary_stressor": "General",
            "risk_level": "moderate",
            "intervention": "validate",
            "insight": "User needs support and validation",
            "cultural_factor": None,
        }
        nlp = ctx.get("nlp_analysis", {})
        emotion = nlp.get("primary_emotion", "unknown")
        intensity = nlp.get("intensity", 0.0)

        session = ctx.get("session_context", {})
        recent = session.get("recent_messages", [])[-3:]

        # mem0 retrieved memories (injected before routing)
        mem0_context = ctx.get("memory_context", "")
        mem_block = mem0_context[:800] if mem0_context else "None"

        conv = "\n".join(
            f"{'U' if m.get('role') == 'user' else 'A'}: {m.get('content', '')[:80]}"
            for m in recent
        ) or "New conversation."

        act_block = self._activity_context_block(ctx)
        act_line = f"\n{act_block}\n" if act_block else ""

        # Cross-session context for clinical continuity
        prev = ctx.get("previous_session_summary", {})
        prev_line = ""
        if prev and prev.get("summary"):
            prev_line = f"\nPrevious session: {prev['summary'][:400]}\n"

        # Voice prosody context (raw tone metrics)
        voice_block = self._build_voice_context_block(ctx)
        voice_line = f"\n{voice_block}" if voice_block else ""

        prompt = (
            "You are a clinical psychologist. Return ONLY valid JSON:\n"
            "{\n"
            '  "emotional_state": "<2-3 word description>",\n'
            '  "primary_stressor": "<Academic|Family|Social|Identity|Career|Relationship|Health>",\n'
            '  "risk_level": "<low|moderate|high|crisis>",\n'
            '  "intervention": "<validate|reframe|ground|problem-solve|refer|psychoeducation>",\n'
            '  "insight": "<single most important clinical observation, one sentence>",\n'
            '  "cultural_factor": "<specific Indian pressure if relevant, else null>"\n'
            "}\n\n"
            f'Message: "{ctx["user_message"][:600]}"\n'
            f"Emotion: {emotion} (intensity {intensity:.1f})\n"
            f"User memories:\n{mem_block}\n"
            f"{act_line}"
            f"{prev_line}"
            f"{voice_line}"
            f"Recent:\n{conv}\n\nJSON:"
        )
        try:
            _t_glm = time.monotonic()
            logger.debug(f"  📡 [PSYCH-OPT] GLM API call ({getattr(self.glm, 'model_name', '?')}) ...")
            resp = self.glm.invoke([{"role": "user", "content": prompt}])
            _glm_ms = (time.monotonic() - _t_glm) * 1000
            if resp and resp.content:
                parsed = parse_json_from_llm_output(resp.content)
                if isinstance(parsed, dict):
                    for k, v in defaults.items():
                        if k not in parsed:
                            parsed[k] = v
                    logger.info(
                        f"✅ [PSYCH-OPT] GLM {_glm_ms:.0f}ms | "
                        f"stressor={parsed.get('primary_stressor')} "
                        f"risk={parsed.get('risk_level')} "
                        f"intervention={parsed.get('intervention')}"
                    )
                    return parsed
        except Exception as e:
            logger.error(f"❌ [PSYCH-OPT] GLM call failed: {e}")
        return defaults

    # ── execution paths ────────────────────────────────────────────────────

    def _path_light(self, ctx: Dict) -> None:
        """
        Path A — 1 GLM call. Casual / small-talk messages.
        Minimal context. Short, warm, conversational response.
        """
        logger.info("━" * 50)
        logger.info("💬 [PATH-A] ▶  EXECUTING: casual/light path (1 GLM call)")
        logger.info("━" * 50)

        # Per-path response length control
        ctx["_response_max_tokens"] = 150

        # Set minimal analysis stubs so return dict never KeyErrors
        ctx["psychological_analysis"] = {
            "emotional_state": "casual",
            "stress_categories": [],
            "risk_assessment": "low",
            "coping_assessment": "",
            "intervention_priority": "long-term",
            "psychological_insights": [],
            "cultural_pressures": "",
        }
        ctx["technique_selection"] = {
            "primary_technique": "Companion",
            "therapeutic_approach": "casual",
            "activity_recommendations": [],
            "rationale": "light conversation",
        }
        # Inject directive: enforce short companion tone, remove clinical framing
        ctx["intervention_directive"] = (
            "This is casual conversation. Be a warm, friendly companion. "
            "Keep your response to 1-3 sentences. Ask one curious question at most. "
            "No clinical framing whatsoever."
        )
        logger.info(f"  📞 [PATH-A] Calling GLM response-gen (model={getattr(self.glm, 'model_name', '?')})...")
        _t = time.monotonic()
        self.response_gen.generate(ctx)
        logger.info(
            f"  ✅ [PATH-A] GLM done in {(time.monotonic()-_t)*1000:.0f}ms | "
            f"response={len(ctx.get('ai_response', ''))} chars"
        )

    def _path_standard(self, ctx: Dict) -> None:
        """
        Path B — 2 LLM calls (1 Groq combined analysis + 1 GLM response).
        For emotional messages. Memory already fetched before routing.
        """
        logger.info("━" * 50)
        logger.info("❤️  [PATH-B] ▶  EXECUTING: emotional/standard path (1 Groq + 1 GLM)")
        logger.info("━" * 50)

        # Per-path response length control
        ctx["_response_max_tokens"] = 300

        logger.info(f"  📞 [PATH-B] Calling Groq combined-analysis (model={getattr(getattr(self, 'groq_nlp', None), 'model', '?')})...")
        _t_combined = time.monotonic()
        with ThreadPoolExecutor(max_workers=1) as executor:
            fut_combined = executor.submit(self._combined_emotion_cultural_analyse, ctx)
            combined = fut_combined.result()
        logger.info(f"  ✅ [PATH-B] Groq combined-analysis done in {(time.monotonic()-_t_combined)*1000:.0f}ms")

        # Populate context fields from combined analysis
        ctx["nlp_analysis"] = {
            "primary_emotion": combined.get("primary_emotion", "unknown"),
            "intensity": combined.get("intensity", 0.5),
            "emotions": {},
            "sentiment": {"score": 0.0, "label": "neutral"},
            "key_phrases": [],
            "language_detected": "en",
            "urgency_flag": False,
        }
        cultural_pressure = combined.get("cultural_pressure", "none")
        ctx["cultural_context"] = {
            "language_style": combined.get("language_style", "english"),
            "hindi_english_ratio": 0.0,
            "code_switching_detected": combined.get("language_style") in ("hinglish", "hindi"),
            "cultural_sensitivity_flags": (
                [cultural_pressure] if cultural_pressure not in ("none", "") else []
            ),
            "communication_pattern": combined.get("tone_match", "warm"),
            "regional_context": "",
            "formality_level": "medium",
        }
        ctx["psychological_analysis"] = {
            "emotional_state": combined.get("primary_emotion", "unknown"),
            "stress_categories": (
                [cultural_pressure.title()] if cultural_pressure not in ("none", "") else ["General"]
            ),
            "risk_assessment": "low",
            "coping_assessment": "",
            "intervention_priority": "supportive",
            "psychological_insights": [],
            "cultural_pressures": cultural_pressure if cultural_pressure != "none" else "",
        }
        ctx["technique_selection"] = {
            "primary_technique": "Validation",
            "therapeutic_approach": combined.get("user_needs", "validation"),
            "activity_recommendations": [],
            "rationale": "emotional support — standard path",
        }

        # Choose directive from user_needs
        user_needs = combined.get("user_needs", "validation")
        needs_to_intervention = {
            "just_to_vent": "validate",
            "validation": "validate",
            "practical_help": "problem-solve",
            "information": "psychoeducation",
            "company": "validate",
        }
        ctx["intervention_directive"] = self._technique_directive(
            needs_to_intervention.get(user_needs, "validate")
        )
        logger.info(
            f"  🧩 [PATH-B] Analysis complete: "
            f"emotion={combined.get('primary_emotion','?')} "
            f"intensity={combined.get('intensity',0):.2f} "
            f"needs={user_needs} "
            f"lang={combined.get('language_style','?')} "
            f"directive='{needs_to_intervention.get(user_needs,'validate')}'"
        )
        logger.info(f"  📞 [PATH-B] Calling GLM response-gen (model={getattr(self.glm, 'model_name', '?')})...")
        _t_gen = time.monotonic()
        self.response_gen.generate(ctx)
        logger.info(
            f"  ✅ [PATH-B] GLM response-gen done in {(time.monotonic()-_t_gen)*1000:.0f}ms | "
            f"response={len(ctx.get('ai_response',''))} chars"
        )

    def _path_rich(self, ctx: Dict) -> None:
        """
        Path C — 2-3 LLM calls. For therapeutic messages.
        Parallel: optimised psych analysis + optional crisis LLM check.
        Memories already fetched before routing.
        """
        logger.info("━" * 50)
        logger.info("🧠 [PATH-C] ▶  EXECUTING: therapeutic/rich path (1 GLM psych + 1 GLM response)")
        logger.info("━" * 50)

        # Per-path response length control
        ctx["_response_max_tokens"] = 500

        # Fast keyword check first (0 ms)
        crisis_level = self._check_crisis_keywords(ctx["user_message"])
        logger.debug(f"  🔍 [PATH-C] In-path crisis scan → '{crisis_level}'")
        if crisis_level == "hard":
            logger.warning("🚨 [PATH-C] Hard crisis keyword inside rich path — fast-pathing to D")
            self._crisis_fast_path(ctx)
            return

        # Run psych analysis; if ambiguous crisis signal, also run LLM check in parallel
        _workers = "GLM psych-analysis" + (" + Groq crisis-check [parallel]" if crisis_level == "ambiguous" else "")
        logger.info(f"  📞 [PATH-C] Calling {_workers}...")
        _t_psych = time.monotonic()
        with ThreadPoolExecutor(max_workers=2) as executor:
            fut_psych = executor.submit(self._optimized_psych_analysis, deepcopy(ctx))
            fut_crisis_llm = (
                executor.submit(self._crisis_llm_check, ctx["user_message"])
                if crisis_level == "ambiguous"
                else None
            )
            psych_result = fut_psych.result()
            is_crisis_llm = fut_crisis_llm.result() if fut_crisis_llm else False
        logger.info(
            f"  ✅ [PATH-C] Psych analysis done in {(time.monotonic()-_t_psych)*1000:.0f}ms | "
            f"stressor={psych_result.get('primary_stressor','?')} "
            f"risk={psych_result.get('risk_level','?')} "
            f"intervention={psych_result.get('intervention','?')}"
        )

        # Crisis escalation: psych analysis or LLM check says crisis
        if is_crisis_llm or psych_result.get("risk_level") == "crisis":
            logger.warning(
                f"🚨 [PATH-C] Crisis escalation: "
                f"risk_level={psych_result.get('risk_level')} llm_crisis={is_crisis_llm}"
            )
            self._crisis_fast_path(ctx)
            return

        # Populate context fields
        ctx["psychological_analysis"] = {
            "emotional_state": psych_result.get("emotional_state", ""),
            "stress_categories": [psych_result.get("primary_stressor", "General")],
            "risk_assessment": psych_result.get("risk_level", "moderate"),
            "coping_assessment": "",
            "intervention_priority": (
                "immediate" if psych_result.get("risk_level") == "high" else "supportive"
            ),
            "psychological_insights": (
                [psych_result["insight"]] if psych_result.get("insight") else []
            ),
            "cultural_pressures": psych_result.get("cultural_factor") or "",
        }
        intervention = psych_result.get("intervention", "validate")
        ctx["technique_selection"] = {
            "primary_technique": intervention.replace("-", " ").title(),
            "therapeutic_approach": intervention,
            "activity_recommendations": [],
            "rationale": psych_result.get("insight", ""),
        }

        # Inject directive from technique lookup (pure Python — zero LLM)
        ctx["intervention_directive"] = self._technique_directive(intervention)
        logger.info(
            f"  🧩 [PATH-C] Psych complete: "
            f"state='{psych_result.get('emotional_state','?')}' "
            f"insight='{str(psych_result.get('insight',''))[:60]}' "
            f"directive='{intervention}'"
        )
        logger.info(f"  📞 [PATH-C] Calling GLM response-gen (model={getattr(self.glm, 'model_name', '?')})...")
        _t_gen = time.monotonic()
        self.response_gen.generate(ctx)
        logger.info(
            f"  ✅ [PATH-C] GLM response-gen done in {(time.monotonic()-_t_gen)*1000:.0f}ms | "
            f"response={len(ctx.get('ai_response',''))} chars"
        )

    # ── main router (safety gate — cannot be bypassed) ────────────────────

    def _route_and_execute(self, ctx: Dict, session_id: Optional[str]) -> None:
        """
        Single entry point for the routed pipeline.

        1. Classify intent via IntentRouter.
        2. Safety gate: keyword crisis check overrides any non-crisis classification.
        3. Dispatch to A / B / C / D.

        This method is the ONLY way to reach the execution paths from process_chat
        when use_routed_pipeline=True, ensuring the crisis gate cannot be skipped.
        """
        text = ctx["user_message"]
        recent = ctx["session_context"].get("recent_messages", [])

        _t_router = time.monotonic()

        # ── Intent classification ──────────────────────────────────────────
        activities = ctx.get("session_context", {}).get("user_activities", [])

        # ── Screening-aware routing: inject PHQ-9/GAD-7 hint if elevated ──
        screening_hint = None
        try:
            from ..services.supabase_service import fetch_latest_screening_scores
            user_id = ctx.get("user_id", "anonymous")
            if user_id != "anonymous" and self.supabase:
                scores = fetch_latest_screening_scores(user_id)
                if scores:
                    phq9 = scores.get("phq9", {})
                    gad7 = scores.get("gad7", {})
                    phq9_sev = phq9.get("severity", "")
                    gad7_sev = gad7.get("severity", "")
                    # Only inject hint when scores indicate concern
                    if phq9_sev in ("moderate", "moderately_severe", "severe") or gad7_sev in ("moderate", "severe"):
                        screening_hint = f"PHQ-9={phq9_sev or 'unknown'} (score {phq9.get('score', '?')}), GAD-7={gad7_sev or 'unknown'} (score {gad7.get('score', '?')})"
                        logger.info(f"📋 [ROUTER] Screening hint injected: {screening_hint}")
        except Exception as screen_exc:
            logger.debug(f"[ROUTER] Screening hint fetch skipped: {screen_exc}")

        if self.intent_router:
            # Build voice hint for routing (concise prosody summary)
            voice_hint = self._build_voice_hint(ctx.get("voice_analysis", {}))
            intent_result = self.intent_router.classify(
                text, recent, activities=activities,
                screening_hint=screening_hint, voice_hint=voice_hint,
            )
        else:
            intent_result = {"intent": "emotional", "confidence": 0.5}
            logger.warning("⚠️ [ROUTER] IntentRouter unavailable — defaulting to 'emotional'")
        intent = intent_result.get("intent", "emotional")
        confidence = intent_result.get("confidence", 0.0)
        logger.info(
            f"🤖 [ROUTER] IntentRouter → intent='{intent}' confidence={confidence:.2f} "
            f"(Groq {getattr(getattr(self, 'groq_nlp', None), 'model', '?')})"
        )

        # ── Safety gate: crisis keyword check (CANNOT be bypassed) ────────
        original_intent = intent
        if intent != "crisis":
            crisis_level = self._check_crisis_keywords(text)
            logger.debug(f"🔍 [CRISIS-SCAN] keyword scan → '{crisis_level}'")
            if crisis_level == "hard":
                logger.warning(
                    f"🚨 [CRISIS-GATE] Hard keyword match — overriding intent "
                    f"'{original_intent}' → 'crisis' (no LLM call needed)"
                )
                intent = "crisis"
            elif crisis_level == "ambiguous":
                logger.info("⚠️ [CRISIS-GATE] Ambiguous keyword — escalating to LLM check")
                _t_crisis = time.monotonic()
                crisis_confirmed = self._crisis_llm_check(text)
                logger.info(
                    f"{'🚨' if crisis_confirmed else '✅'} [CRISIS-GATE] LLM check "
                    f"→ {'CRISIS CONFIRMED' if crisis_confirmed else 'safe'} "
                    f"({(time.monotonic()-_t_crisis)*1000:.0f}ms)"
                )
                if crisis_confirmed:
                    intent = "crisis"
            else:
                logger.debug("✅ [CRISIS-GATE] No crisis signal detected")
        else:
            logger.info("🚨 [CRISIS-GATE] IntentRouter already classified as crisis")

        logger.info(
            f"🗺️  [ROUTER] DISPATCH → path={'D (crisis)' if intent=='crisis' else 'A (casual)' if intent=='casual' else 'B (emotional)' if intent=='emotional' else 'C (therapeutic)'} "
            f"[router_time={(time.monotonic()-_t_router)*1000:.0f}ms]"
        )

        # ── Memory retrieval (mem0 — sync, fast) ─────────────────────────
        try:
            mem_ctx = memory_manager.retrieve_memories(
                query=text,
                user_id=ctx.get("user_id", "anonymous"),
                intent=intent,
            )
            if mem_ctx:
                ctx["memory_context"] = mem_ctx
                logger.info(f"🧠 [MEMORY] Injected memory context ({len(mem_ctx)} chars)")
        except Exception as mem_exc:
            logger.error(f"❌ [MEMORY] retrieve_memories failed (non-blocking): {mem_exc}")

        # ── Emotional trend (cross-session continuity) ────────────────────
        try:
            trend = memory_manager.get_emotional_trend(ctx.get("user_id", "anonymous"))
            if trend:
                existing = ctx.get("memory_context", "")
                ctx["memory_context"] = existing + f"\n\n📈 EMOTIONAL TREND (recent sessions): {trend}"
                logger.info(f"📈 [TREND] Injected emotional trend ({len(trend)} chars)")
        except Exception as trend_exc:
            logger.error(f"❌ [TREND] get_emotional_trend failed (non-blocking): {trend_exc}")

        # ── Dispatch ───────────────────────────────────────────────────────
        if intent == "crisis":
            ctx["_pipeline_path"] = "D-crisis"
            self._crisis_fast_path(ctx)
        elif intent == "casual":
            ctx["_pipeline_path"] = "A-casual"
            self._path_light(ctx)
        elif intent == "emotional":
            ctx["_pipeline_path"] = "B-emotional"
            self._path_standard(ctx)
        else:  # therapeutic
            ctx["_pipeline_path"] = "C-therapeutic"
            self._path_rich(ctx)

    # ── core pipeline ──────────────────────────────────────────────────────
    def process_chat(
        self,
        user_message: str,
        recent_messages: Optional[List] = None,
        conversation_summary: Optional[Dict] = None,
        user_activities: Optional[List] = None,
        user_patterns: Optional[Dict] = None,
        voice_analysis: Optional[Dict] = None,
        user_id: str = "anonymous",
        session_id: Optional[str] = None,
        personality: Optional[str] = None,
        companion_name: Optional[str] = None,
        language: Optional[str] = None,
        previous_session_summary: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Main processing pipeline — same signature & return format as original."""
        start_time = datetime.now()
        _t0 = time.monotonic()
        logger.info(
            "═" * 60 + "\n"
            f"  🚀 MINDMITRA PIPELINE START\n"
            f"  user={user_id[:12] if user_id else '?'}  "
            f"session={str(session_id)[:8] if session_id else 'none'}\n"
            f"  personality={personality or 'mitra'}  lang={language or 'english'}\n"
            f"  msg_len={len(user_message)}  recent={len(recent_messages or [])}\n"
            + "═" * 60
        )

        # Step 1: build context envelope
        ctx = create_empty_user_context(user_id, session_id, user_message.strip())
        ctx["voice_analysis"] = voice_analysis or {}
        ctx["session_context"]["recent_messages"] = recent_messages or []
        ctx["session_context"]["conversation_summary"] = conversation_summary or {}
        ctx["session_context"]["user_activities"] = user_activities or []
        ctx["session_context"]["user_patterns"] = user_patterns or {}

        # Cross-session continuity — previous session summary
        if previous_session_summary:
            ctx["previous_session_summary"] = previous_session_summary

        # Inject user personality preferences into context
        # Map personality names to default companion names
        _default_names = {
            "mitra": "Mitra", "arjun": "Arjun", "diya": "Diya",
            "riya": "Riya", "zen": "Zen",
        }
        resolved_personality = personality or "mitra"
        resolved_name = companion_name or _default_names.get(resolved_personality, "Mitra")
        ctx["personality_settings"] = {
            "personality": resolved_personality,
            "companion_name": resolved_name,
            "language": language or "english",
        }

        # ── Execute routed pipeline ──────────────────────────────────────────
        # Crisis check + intent routing → path A / B / C / D
        self._route_and_execute(ctx, session_id)

        processing_time = (datetime.now() - start_time).total_seconds()

        # Step 8: fire-and-forget context save
        threading.Thread(
            target=self.save_user_context_to_file,
            args=(ctx, f"user_context_{ctx['user_id']}.json"),
            daemon=True,
        ).start()

        processing_elapsed = time.monotonic() - _t0
        psych = ctx["psychological_analysis"]
        technique = ctx["technique_selection"]
        _path_tag = ctx.get("_pipeline_path", "legacy")
        logger.info(
            "═" * 60 + "\n"
            f"  ✅ MINDMITRA PIPELINE COMPLETE\n"
            f"  path={_path_tag}  total_time={processing_elapsed:.2f}s\n"
            f"  emotion={psych.get('emotional_state','?')}  "
            f"risk={psych.get('risk_assessment','?')}\n"
            f"  technique={technique.get('primary_technique','?')}  "
            f"intervention={technique.get('therapeutic_approach','?')}\n"
            f"  response_len={len(ctx.get('ai_response',''))}\n"
            + "═" * 60
        )

        return {
            "message": ctx["ai_response"],
            "modality": technique.get("primary_technique", "Person-Centered"),
            "confidence": 0.9,
            "processing_time": processing_time,
            "session_insights": {
                "emotional_state": psych.get("emotional_state", ""),
                "stress_categories": psych.get("stress_categories", []),
                "therapeutic_approach": technique.get("primary_technique", ""),
                "cultural_pressures": psych.get("cultural_pressures", ""),
                "language_style": ctx["cultural_context"].get("language_style", ""),
                "psychological_insights": psych.get("psychological_insights", []),
                "coping_assessment": psych.get("coping_assessment", ""),
                "intervention_priority": psych.get("intervention_priority", ""),
                "activity_recommendations": technique.get("activity_recommendations", []),
                "nlp_analysis": ctx["nlp_analysis"],
                "cultural_context": ctx["cultural_context"],
                "technique_rationale": technique.get("rationale", ""),
                "performance_metrics": {
                    "context_messages": len(ctx["session_context"]["recent_messages"]),
                    "context_activities": len(ctx["session_context"]["user_activities"]),
                    "has_summary": bool(ctx["session_context"]["conversation_summary"]),
                    "memory_count": sum(len(v) for v in ctx["session_context"]["session_memories"].values()),
                },
            },
        }


# ── global singleton ────────────────────────────────────────────────────────
_workflow_instance: Optional[MindMitraWorkflow] = None


def get_workflow_instance() -> MindMitraWorkflow:
    global _workflow_instance
    if _workflow_instance is None:
        _workflow_instance = MindMitraWorkflow()
    return _workflow_instance


def process_user_chat(
    user_message: str,
    recent_messages: Optional[List] = None,
    conversation_summary: Optional[Dict] = None,
    user_activities: Optional[List] = None,
    user_patterns: Optional[Dict] = None,
    voice_analysis: Optional[Dict] = None,
    user_id: str = "anonymous",
    session_id: Optional[str] = None,
    personality: Optional[str] = None,
    companion_name: Optional[str] = None,
    language: Optional[str] = None,
    previous_session_summary: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Public entry point — identical signature to original v1."""
    import time
    logger.info(f"🚀 [ENTRY] MindMitra v2 — user={user_id}, session={session_id}")
    if personality:
        logger.info(f"🎭 [ENTRY] Personality={personality}, name={companion_name}, lang={language}")
    start = time.time()
    try:
        workflow = get_workflow_instance()
        result = workflow.process_chat(
            user_message, recent_messages, conversation_summary,
            user_activities, user_patterns, voice_analysis, user_id, session_id,
            personality=personality, companion_name=companion_name, language=language,
            previous_session_summary=previous_session_summary,
        )
        result["processing_time"] = round(time.time() - start, 2)
        result["voice_aware"] = bool(voice_analysis)
        logger.info(f"✅ [ENTRY] Done in {result['processing_time']}s")
        return result
    except Exception as e:
        logger.error(f"❌ [ENTRY] Failed after {time.time()-start:.2f}s: {e}")
        raise
