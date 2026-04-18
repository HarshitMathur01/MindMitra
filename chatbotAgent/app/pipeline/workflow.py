"""
MindMitra Pipeline Workflow — COMPASS + MEMOIR orchestration entry point.

Builds the UserContext envelope, dispatches to PipelineOrchestrator
(COMPASS routing), and formats the result for callers.
"""
import logging
import os
import threading
import time
from .crisis_manager import CrisisManager
from .pipeline_orchestrator import PipelineOrchestrator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client, create_client, ClientOptions

from ..agents.analysis_agent import AnalysisAgent
from ..agents.response_agent import ResponseGenerator
from ..agents.memory_manager import memory_manager
from ..agents.screening_agent import ScreeningAssessmentAgent
from ..controllers.llm_controller import LLMController
from ..controllers.azure_controller import AzureController
from ..core.config import config
from ..pipeline.context import create_empty_user_context
logger = logging.getLogger(__name__)


class MindMitraWorkflow:
    """
    Entry point for a single chat turn:
      1. Build UserContext envelope
      2. Dispatch to PipelineOrchestrator (COMPASS: cognitive layer → A/B/C/D paths)
      3. Non-blocking: persist context to Supabase
      4. Return formatted result dict
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
            options = ClientOptions(postgrest_client_timeout=15.0)
            self.supabase: Optional[Client] = create_client(supabase_url, supabase_key, options=options)
            logger.info("✅ [WORKFLOW] Supabase client ready")
        else:
            self.supabase = None
            logger.warning("⚠️ [WORKFLOW] Supabase not configured or disabled")

        self._user_contexts_table_available: bool = self.feature_flags.get("user_contexts_table", True)

        # ── Agents & controllers ──────────────────────────────
        self.groq_nlp: Optional[AnalysisAgent] = AnalysisAgent() if self.feature_flags.get("nlp_analysis", True) else None
        _llm_provider = config.get("response_generator.llm_provider", "glm")
        if _llm_provider == "azure":
            self.glm = AzureController()
            logger.info("🔀 [WORKFLOW] Using Azure OpenAI for response generation")
        else:
            self.glm = LLMController()
        self.screening_agent: Optional[ScreeningAssessmentAgent] = (
            ScreeningAssessmentAgent(self.groq_nlp, self.glm) if self.feature_flags.get("screening_assessments", True) else None
        )
        self.response_gen = ResponseGenerator(self.glm)

        self._summarization_cache: Dict = {}
        self._last_summarization_count: Dict = {}
        self.crisis_manager = CrisisManager(self.groq_nlp, self.supabase)
        self.orchestrator = PipelineOrchestrator(
            self.groq_nlp,
            self.glm,
            self.response_gen,
            self.crisis_manager,
            self.supabase,
        )

        logger.info("✅ [WORKFLOW] MindMitra v2 fully initialised\n")

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
            # Remove non-serializable objects (like functions)
            ctx_to_save = {k: v for k, v in context.items() if k != "chunk_callback"}
            user_id = ctx_to_save.get("user_id")
            if not user_id:
                return
            payload = {
                "user_id": user_id,
                "context": ctx_to_save,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table("user_contexts").upsert(payload, on_conflict="user_id").execute()
            logger.info("✅ [FILE] UserContext saved to Supabase")
        except Exception as e:
            err = str(e).lower()
            if "pgrst205" in err and "user_contexts" in err:
                self._user_contexts_table_available = False
                logger.warning("⚠️ [FILE] 'user_contexts' table missing; disabling upserts")
            elif "23503" in err and "user_contexts" in err:
                logger.debug(
                    "⚠️ [FILE] user_contexts upsert skipped — user_id not in public.users "
                    "(common with SKIP_AUTH and synthetic UUIDs): %s",
                    e,
                )
            else:
                logger.warning(f"⚠️ [FILE] Supabase upsert failed: {e}")

    # ── memory helpers ─────────────────────────────────────────────────────
    def save_user_context_to_file(self, user_context: Dict, file_name: str) -> None:
        """Saves user context asynchronously. File save logic deprecated, redirects to DB."""
        try:
            resolved_uid = self._resolve_user_id_from_supabase(user_context)
            if resolved_uid:
                user_context["user_id"] = resolved_uid

            self._save_user_context_to_supabase(user_context)
        except Exception as e:
            logger.error(f"❌ [DB] Failed to save user context: {e}")

    # ── core pipeline ──────────────────────────────────────────────────────

    # ── class-level constants ──────────────────────────────────────────────



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
        chunk_callback=None,
        message_count: int = 0,
        eval_trace: bool = False,
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
        ctx["_eval_trace_requested"] = bool(eval_trace)
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
        
        if chunk_callback:
            ctx["chunk_callback"] = chunk_callback

        # ── Execute routed pipeline ──────────────────────────────────────────
        # Crisis check + intent routing → path A / B / C / D
        self.orchestrator.route_and_execute(ctx, session_id, message_count=message_count)

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
        _path_tag = ctx.get("_pipeline_path", "unknown")
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

        eval_trace_payload: Optional[Dict[str, Any]] = None
        if ctx.get("_eval_trace_requested"):
            mem = ctx.get("memory_context") or ""
            ed = ctx.get("_eval_data") or {}
            stage_timings = {}
            try:
                s1 = (ed.get("stage1") or {}).get("latency_ms")
                cl = (ed.get("cognitive_layer") or {}).get("latency_ms")
                rg = (ed.get("response_gen") or {}).get("llm_ms")
                if s1 is not None:
                    stage_timings["stage1_ms"] = float(s1)
                if cl is not None:
                    stage_timings["cognitive_ms"] = float(cl)
                if rg is not None:
                    stage_timings["response_llm_ms"] = float(rg)
            except Exception:
                stage_timings = {}
            eval_trace_payload = {
                "pipeline_path": ctx.get("_pipeline_path"),
                "routed_intent": ctx.get("cl_intent"),
                "memory_injected": bool(mem.strip()),
                "memory_context_preview": mem[:8000],
                "memory_char_len": len(mem),
                "risk_assessment": psych.get("risk_assessment"),
                "emotional_state": psych.get("emotional_state"),
                "stage_timings": stage_timings,
            }
            _eval_extra = ctx.get("_eval_data") or {}
            if _eval_extra:
                eval_trace_payload.update(_eval_extra)
            for _ek, _ev in ctx.items():
                if isinstance(_ek, str) and _ek.startswith("cl_"):
                    eval_trace_payload[_ek] = _ev

        out: Dict[str, Any] = {
            "message": ctx["ai_response"],
            "modality": technique.get("primary_technique", "Person-Centered"),
            "confidence": 0.9,
            "processing_time": processing_time,
            "session_insights": {
                "conversation_stage": ctx.get("_conversation_stage", "unknown"),
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
        if eval_trace_payload is not None:
            out["eval_trace"] = eval_trace_payload

        # Post-stream hooks (e.g. SSE safety audit / arc logging) read cl_* + ai_response from result
        out["ai_response"] = ctx.get("ai_response", "")
        for _k, _v in ctx.items():
            if isinstance(_k, str) and _k.startswith("cl_"):
                out[_k] = _v

        return out


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
    chunk_callback=None,
    message_count: int = 0,
    eval_trace: bool = False,
) -> Dict[str, Any]:
    """Public entry point — identical signature to original v1."""
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
            chunk_callback=chunk_callback,
            message_count=message_count,
            eval_trace=eval_trace,
        )
        result["processing_time"] = round(time.time() - start, 2)
        result["voice_aware"] = bool(voice_analysis)
        logger.info(f"✅ [ENTRY] Done in {result['processing_time']}s")
        return result
    except Exception as e:
        logger.error(f"❌ [ENTRY] Failed after {time.time()-start:.2f}s: {e}")
        raise
