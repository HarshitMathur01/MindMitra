"""
Pipeline Orchestrator — Execution routing based on intent and constraints.

This module maps the path classification (light, standard, rich, crisis) into
executable pipeline flows. It controls which LLM tools (e.g. AnalysisAgent, LLMController)
are invoked, how context blocks max_tokens are managed, and explicitly handles
the invocation logic separating the main flow into manageable atomic actions.
"""
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from typing import Dict, Any, Optional

from .analysis_engine import AnalysisEngine
from .crisis_manager import CrisisManager
from ..agents.memory_manager import memory_manager
from ..agents.intent_router import IntentRouter
from ..agents.response_agent import ResponseGenerator
from ..controllers.llm_controller import LLMController
from ..agents.analysis_agent import AnalysisAgent
from ..core.config import config
from ..services.locale_service import resolve_locale
from supabase import Client

logger = logging.getLogger(__name__)


def _path_generation_int(azure_subkey: str, default: int) -> int:
    """Read per-path limit from azure_controller, then glm_controller (same keys for both providers)."""
    v = config.get(f"azure_controller.{azure_subkey}")
    if v is not None:
        return int(v)
    v2 = config.get(f"glm_controller.{azure_subkey}")
    if v2 is not None:
        return int(v2)
    return default


def _path_generation_float(azure_subkey: str, glm_subkey: str, default: float) -> float:
    v = config.get(f"azure_controller.{azure_subkey}")
    if v is not None:
        return float(v)
    v2 = config.get(f"glm_controller.{glm_subkey}")
    if v2 is not None:
        return float(v2)
    return default


class PipelineOrchestrator:
    """
    Orchestrates the intent-routed execution paths (A/B/C/D).
    Coordinates intent routing, crisis checks, memory integration,
    and delegating generation to the ResponseAgent.
    """

    _TECHNIQUE_DIRECTIVES: Dict[str, str] = {
        "validate": (
            "Be fully present — no advice, no reframes. "
            "Name the specific feeling beneath their words ('that exhaustion that sleep doesn't fix' > 'you seem tired'). "
            "Reflect the weight of what they said, not just its surface."
        ),
        "reframe": (
            "Plant one gentle alternative perspective as a seed, not a correction. "
            "Tone: 'I wonder if there's another way to read that...' / "
            "'What if the fact this hurts so much means you actually care deeply about getting it right.'"
        ),
        "ground": (
            "Bring their attention to the present moment — body, breath, or what they can sense right now. "
            "Weave it naturally: 'Take a breath with me' / 'Notice your feet on the floor — that's real.' "
            "Make it a shared moment, not a prescribed exercise."
        ),
        "problem-solve": (
            "Acknowledge the size of the problem first, then name one small, achievable step they can take right now. "
            "'What if you just did the first five minutes.' Goal is agency, not a full plan."
        ),
        "refer": (
            "Acknowledge warmly that this is bigger than a chat can hold. "
            "Frame professional support as strength: 'Reaching out to someone trained in this is taking yourself seriously.' "
            "Stay connected — walk alongside them toward more support, don't hand them off."
        ),
        "psychoeducation": (
            "Share one normalizing insight using a relatable analogy "
            "('Your brain is running a fire drill — that anxious feeling is your alarm doing its job, just a bit too enthusiastically.'). "
            "Conversational and concise — a gift, not a lecture."
        ),
    }

    def __init__(
        self,
        groq_nlp: Optional[AnalysisAgent],
        glm: LLMController,
        intent_router: Optional[IntentRouter],
        response_gen: ResponseGenerator,
        crisis_manager: CrisisManager,
        supabase: Optional[Client],
    ) -> None:
        self.groq_nlp = groq_nlp
        self.glm = glm
        self.intent_router = intent_router
        self.response_gen = response_gen
        self.crisis_manager = crisis_manager
        self.supabase = supabase

    @staticmethod
    def _build_voice_hint(voice: Dict) -> Optional[str]:
        """
        Build a concise voice prosody summary for intent routing.
        Returns None if no meaningful voice data available.
        """
        if not voice:
            return None

        parts = []
        wpm = voice.get("speech_rate_wpm")
        if wpm:
            parts.append(f"{wpm} WPM ({voice.get('speech_rate_category', 'normal')})")

        pause = voice.get("pause_pattern")
        if pause and pause != "minimal":
            parts.append(f"pauses: {pause}")

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

    _QUESTION_CONSTRAINTS: Dict[str, str] = {
        "trust_window": " Ask at most ONE warm, specific question. Prefer reflective statements like 'I wonder...' or 'It sounds like...'.",
        "deepening": " Ask at most ONE question. Prefer 'I wonder...' and observational statements over direct questions.",
        "insight": " Ask at most one gentle question in your entire response. Prefer 'I wonder...' statements.",
        "companion": " Ask at most one question in your entire response. Lead with statements.",
    }

    @staticmethod
    def _get_question_constraint(ctx: Dict) -> str:
        """Return a question constraint string based on conversation stage."""
        stage = ctx.get("_conversation_stage", "companion")
        return PipelineOrchestrator._QUESTION_CONSTRAINTS.get(
            stage, PipelineOrchestrator._QUESTION_CONSTRAINTS["companion"]
        )

    def _technique_directive(self, intervention: str) -> str:
        """Pure Python dict lookup. Zero LLM calls."""
        return self._TECHNIQUE_DIRECTIVES.get(intervention.lower(), self._TECHNIQUE_DIRECTIVES["validate"])

    def _path_light(self, ctx: Dict) -> None:
        """
        Path A — 1 GLM call. Casual / small-talk messages.
        Minimal context. Short, warm, conversational response.
        """
        logger.info("━" * 50)
        logger.info("💬 [PATH-A] ▶  EXECUTING: casual/light path (1 GLM call)")
        logger.info("━" * 50)

        ctx["_response_max_tokens"] = _path_generation_int("max_tokens_path_a", 384)
        ctx["_response_temperature"] = _path_generation_float("temperature_path_a", "temperature_path_a", 0.8)
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
        ctx["intervention_directive"] = (
            "CASUAL — light conversation, no therapeutic depth. "
            "1-3 sentences, warm and specific to exactly what they just said. "
            "Memory is available but don't force callbacks on a casual turn — use only if it fits naturally. "
            "Sound like a real person who is genuinely interested, not a support bot."
            + self._get_question_constraint(ctx)
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

        ctx["_response_max_tokens"] = _path_generation_int("max_tokens_path_b", 720)
        ctx["_response_temperature"] = _path_generation_float("temperature_path_b", "temperature_path_b", 0.6)

        logger.info(f"  📞 [PATH-B] Calling Groq combined-analysis (model={getattr(getattr(self, 'groq_nlp', None), 'model', '?')})...")
        _t_combined = time.monotonic()
        combined = AnalysisEngine.combined_emotion_cultural_analyse(self.groq_nlp, ctx)
        logger.info(f"  ✅ [PATH-B] Groq combined-analysis done in {(time.monotonic()-_t_combined)*1000:.0f}ms")

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

        user_needs = combined.get("user_needs", "validation")
        needs_to_intervention = {
            "just_to_vent": "validate",
            "validation": "validate",
            "practical_help": "problem-solve",
            "information": "psychoeducation",
            "company": "validate",
        }
        ctx["intervention_directive"] = (
            self._technique_directive(needs_to_intervention.get(user_needs, "validate"))
            + self._get_question_constraint(ctx)
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

        ctx["_response_max_tokens"] = _path_generation_int("max_tokens_path_c", 1024)
        ctx["_response_temperature"] = _path_generation_float("temperature_path_c", "temperature_path_c", 0.55)

        # Fast keyword check first (0 ms)
        crisis_level = self.crisis_manager.check_crisis_keywords(ctx["user_message"])
        logger.debug(f"  🔍 [PATH-C] In-path crisis scan → '{crisis_level}'")
        if crisis_level == "hard":
            logger.warning("🚨 [PATH-C] Hard crisis keyword inside rich path — fast-pathing to D")
            self.crisis_manager.crisis_fast_path(ctx)
            return

        # Run psych analysis; if ambiguous crisis signal, also run LLM check in parallel
        _workers = "GLM psych-analysis" + (" + Groq crisis-check [parallel]" if crisis_level == "ambiguous" else "")
        logger.info(f"  📞 [PATH-C] Calling {_workers}...")
        _t_psych = time.monotonic()
        with ThreadPoolExecutor(max_workers=2) as executor:
            fut_psych = executor.submit(AnalysisEngine.optimized_psych_analysis, self.glm, deepcopy(ctx))
            fut_crisis_llm = (
                executor.submit(self.crisis_manager.crisis_llm_check, ctx["user_message"])
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
            self.crisis_manager.crisis_fast_path(ctx)
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

        ctx["intervention_directive"] = (
            self._technique_directive(intervention)
            + self._get_question_constraint(ctx)
        )
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

    def route_and_execute(self, ctx: Dict, session_id: Optional[str], message_count: int = 0) -> None:
        """
        Single entry point for the routed pipeline.
        1. Classify intent via IntentRouter.
        2. Safety gate: keyword crisis check overrides any non-crisis classification.
        3. Dispatch to A / B / C / D.

        Args:
            message_count: Pre-fetched session message count (avoids a duplicate DB query).
                           Pass 0 to let the orchestrator fetch it itself.
        """
        text = ctx["user_message"]
        recent = ctx["session_context"].get("recent_messages", [])

        # Resolve locale (client setting wins, then script detection, then default)
        client_lang = ctx.get("personality_settings", {}).get("language")
        locale_ctx = resolve_locale(text, client_lang)
        ctx["personality_settings"]["language"] = locale_ctx.locale
        ctx["locale_context"] = {
            "locale": locale_ctx.locale,
            "bcp47": locale_ctx.bcp47,
            "confidence": locale_ctx.confidence,
            "source": locale_ctx.source,
        }

        _t_router = time.monotonic()

        activities = ctx.get("session_context", {}).get("user_activities", [])

        # ── Conversation stage (compute once — used for question budget + screening gate) ──
        from ..services.supabase_service import get_hybrid_message_count
        from ..utils.constants import STAGE_TRUST_WINDOW_MAX, STAGE_DEEPENING_MAX, STAGE_INSIGHT_MAX, SCREENING_MIN_MESSAGES
        # Use the pre-fetched count when available — avoids a duplicate Supabase COUNT(*) call
        session_msg_count = message_count if message_count > 0 else (
            get_hybrid_message_count(session_id) if session_id else len(recent)
        )

        # ── Screening-aware routing: inject PHQ-9/GAD-7 hint only when relevant ──
        # Gate behind SCREENING_MIN_MESSAGES to skip the DB lookup for new sessions.
        # fetch_latest_screening_scores is cached (5-min TTL) so re-calls are cheap.
        screening_hint = None
        if session_msg_count >= SCREENING_MIN_MESSAGES:
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
                        if phq9_sev in ("moderate", "moderately_severe", "severe") or gad7_sev in ("moderate", "severe"):
                            screening_hint = f"PHQ-9={phq9_sev or 'unknown'} (score {phq9.get('score', '?')}), GAD-7={gad7_sev or 'unknown'} (score {gad7.get('score', '?')})"
                            logger.info(f"📋 [ROUTER] Screening hint injected: {screening_hint}")
            except Exception as screen_exc:
                logger.debug(f"[ROUTER] Screening hint fetch skipped: {screen_exc}")

        if self.intent_router:
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
        ctx["_eval_router_intent_raw"] = intent
        logger.info(
            f"🤖 [ROUTER] IntentRouter → intent='{intent}' confidence={confidence:.2f} "
            f"(Groq {getattr(self.groq_nlp, 'model', '?') if self.groq_nlp else '?'})"
        )

        # ── Safety gate: crisis keyword check (CANNOT be bypassed) ────────
        original_intent = intent
        if intent != "crisis":
            crisis_level = self.crisis_manager.check_crisis_keywords(text)
            logger.debug(f"🔍 [CRISIS-SCAN] keyword scan → '{crisis_level}'")
            if crisis_level == "hard":
                logger.warning(
                    f"🚨 [CRISIS-GATE] Hard keyword match — overriding intent "
                    f"'{original_intent}' → 'crisis'"
                )
                intent = "crisis"
            elif crisis_level == "ambiguous":
                logger.info("⚠️ [CRISIS-GATE] Ambiguous keyword — escalating to LLM check")
                _t_crisis = time.monotonic()
                crisis_confirmed = self.crisis_manager.crisis_llm_check(text)
                logger.info(
                    f"{'🚨' if crisis_confirmed else '✅'} [CRISIS-GATE] LLM check "
                    f"→ {'CRISIS CONFIRMED' if crisis_confirmed else 'safe'} "
                    f"({(time.monotonic()-_t_crisis)*1000:.0f}ms)"
                )
                if crisis_confirmed:
                    intent = "crisis"
        else:
            logger.info("🚨 [CRISIS-GATE] IntentRouter already classified as crisis")

        logger.info(
            f"🗺️  [ROUTER] DISPATCH → path={'D (crisis)' if intent=='crisis' else 'A (casual)' if intent=='casual' else 'B (emotional)' if intent=='emotional' else 'C (therapeutic)'} "
            f"[router_time={(time.monotonic()-_t_router)*1000:.0f}ms]"
        )
        ctx["_eval_routed_intent"] = intent

        # ── Memory retrieval + emotional trend (parallel) ────────────────
        # Both calls are independent — run concurrently.
        # A 2.5 s timeout guards against slow Qdrant / embedding cold-starts;
        # on timeout we continue without memory context rather than block the
        # entire response.
        _user_id = ctx.get("user_id", "anonymous")
        _MEMORY_TIMEOUT = float(
            config.get("performance.pipeline_memory_parallel_timeout_seconds", 5.0)
        )

        with ThreadPoolExecutor(max_workers=2) as _mem_ex:
            fut_mem   = _mem_ex.submit(
                memory_manager.retrieve_memories,
                text, _user_id, intent,
            )
            fut_trend = _mem_ex.submit(
                memory_manager.get_emotional_trend,
                _user_id,
            )

            # Collect memory context with timeout
            try:
                mem_ctx = fut_mem.result(timeout=_MEMORY_TIMEOUT)
                if mem_ctx:
                    ctx["memory_context"] = mem_ctx
                    logger.info(f"🧠 [MEMORY] Injected memory context ({len(mem_ctx)} chars)")
                    if os.getenv("MM_PIPELINE_DEBUG", "").lower() in ("1", "true", "yes"):
                        preview = mem_ctx[:1200].replace("\n", " ")
                        logger.info("[MM_PIPELINE_DEBUG] memory_context_preview (1200c): %s", preview)
            except TimeoutError:
                logger.warning(f"⏱️ [MEMORY] retrieve_memories timed out ({_MEMORY_TIMEOUT}s) — skipping")
                mem_ctx = ""
            except Exception as mem_exc:
                logger.error(f"❌ [MEMORY] retrieve_memories failed: {mem_exc}")
                mem_ctx = ""

            # Collect emotional trend — typically fast (cached by prewarm thread)
            try:
                trend = fut_trend.result(timeout=_MEMORY_TIMEOUT)
                if trend:
                    existing = ctx.get("memory_context", "")
                    ctx["memory_context"] = existing + f"\n\n📈 EMOTIONAL TREND (recent sessions): {trend}"
                    logger.info(f"📈 [TREND] Injected emotional trend ({len(trend)} chars)")
            except TimeoutError:
                logger.warning(f"⏱️ [TREND] get_emotional_trend timed out ({_MEMORY_TIMEOUT}s) — skipping")
            except Exception as trend_exc:
                logger.error(f"❌ [TREND] get_emotional_trend failed: {trend_exc}")

        if os.getenv("MM_MEMORY_TRACE", "").lower() in ("1", "true", "yes"):
            _mem_final = ctx.get("memory_context") or ""
            logger.info(
                "[MM_MEMORY_TRACE] orchestrator after_memory+trend: user=%s... last_user_query=%r "
                "memory_context_chars=%s",
                str(_user_id)[:14],
                (text or "")[:240],
                len(_mem_final),
            )

        # ── Conversation stage (for question budget) ─────────────────────
        # session_msg_count already computed above (pre-fetched from outer scope or DB)
        if session_msg_count <= STAGE_TRUST_WINDOW_MAX:
            ctx["_conversation_stage"] = "trust_window"
        elif session_msg_count <= STAGE_DEEPENING_MAX:
            ctx["_conversation_stage"] = "deepening"
        elif session_msg_count <= STAGE_INSIGHT_MAX:
            ctx["_conversation_stage"] = "insight"
        else:
            ctx["_conversation_stage"] = "companion"
        logger.info(f"📊 [STAGE] Conversation stage: {ctx['_conversation_stage']} (msg_count={session_msg_count})")

        # ── Dispatch ───────────────────────────────────────────────────────
        if intent == "crisis":
            ctx["_pipeline_path"] = "D-crisis"
            self.crisis_manager.crisis_fast_path(ctx)
        elif intent == "casual":
            ctx["_pipeline_path"] = "A-casual"
            self._path_light(ctx)
        elif intent == "emotional":
            ctx["_pipeline_path"] = "B-emotional"
            self._path_standard(ctx)
        else:  # therapeutic
            ctx["_pipeline_path"] = "C-therapeutic"
            self._path_rich(ctx)
