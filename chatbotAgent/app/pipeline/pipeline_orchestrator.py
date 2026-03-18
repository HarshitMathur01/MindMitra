"""
Pipeline Orchestrator — Execution routing based on intent and constraints.

This module maps the path classification (light, standard, rich, crisis) into
executable pipeline flows. It controls which LLM tools (e.g. AnalysisAgent, LLMController)
are invoked, how context blocks max_tokens are managed, and explicitly handles
the invocation logic separating the main flow into manageable atomic actions.
"""
import logging
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
from supabase import Client

logger = logging.getLogger(__name__)

class PipelineOrchestrator:
    """
    Orchestrates the intent-routed execution paths (A/B/C/D).
    Coordinates intent routing, crisis checks, memory integration,
    and delegating generation to the ResponseAgent.
    """

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

        ctx["_response_max_tokens"] = 150
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

        ctx["_response_max_tokens"] = 300

        logger.info(f"  📞 [PATH-B] Calling Groq combined-analysis (model={getattr(getattr(self, 'groq_nlp', None), 'model', '?')})...")
        _t_combined = time.monotonic()
        with ThreadPoolExecutor(max_workers=1) as executor:
            fut_combined = executor.submit(AnalysisEngine.combined_emotion_cultural_analyse, self.groq_nlp, ctx)
            combined = fut_combined.result()
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

        ctx["_response_max_tokens"] = 500

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

    def route_and_execute(self, ctx: Dict, session_id: Optional[str]) -> None:
        """
        Single entry point for the routed pipeline.
        1. Classify intent via IntentRouter.
        2. Safety gate: keyword crisis check overrides any non-crisis classification.
        3. Dispatch to A / B / C / D.
        """
        text = ctx["user_message"]
        recent = ctx["session_context"].get("recent_messages", [])

        _t_router = time.monotonic()

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
            logger.error(f"❌ [MEMORY] retrieve_memories failed: {mem_exc}")

        # ── Emotional trend (cross-session continuity) ────────────────────
        try:
            trend = memory_manager.get_emotional_trend(ctx.get("user_id", "anonymous"))
            if trend:
                existing = ctx.get("memory_context", "")
                ctx["memory_context"] = existing + f"\n\n📈 EMOTIONAL TREND (recent sessions): {trend}"
                logger.info(f"📈 [TREND] Injected emotional trend ({len(trend)} chars)")
        except Exception as trend_exc:
            logger.error(f"❌ [TREND] get_emotional_trend failed: {trend_exc}")

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
