"""
MindMitra Pipeline Workflow — orchestrates all agents through the 8-step pipeline.
"""
import json
import logging
import os
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client, create_client

from ..agents.cultural_agent import CulturalContextModule
from ..agents.nlp_agent import GroqNLPModule
from ..agents.psychologist_agent import PsychologistAnalysisAgent
from ..agents.query_decision import QueryDecisionAgent
from ..agents.response_agent import ResponseGenerator
from ..agents.screening_agent import ScreeningAssessmentAgent
from ..agents.technique_agent import TechniqueSelectorAgent
from ..controllers.embeddings import EmbeddingService
from ..controllers.glm_controller import GLMController
from ..core.config import config
from ..memory.deduplicator import MemoryDeduplicator
from ..memory.episodic_promoter import EpisodicPromoter
from ..memory.memory_system import UniversalMemorySystem
from ..memory.rag_retrieval import MemoryRetriever
from ..pipeline.context import create_empty_user_context
from ..utils.json_utils import compact_for_merge_prompt, parse_json_from_llm_output

logger = logging.getLogger(__name__)


class MindMitraWorkflow:
    """
    Orchestrates the full 8-step pipeline:
      1. Build UserContext JSON
      2. Fetch memories → session_context
      3. Groq NLP → nlp_analysis
      4. Cultural context → cultural_context
      4.5 RAG memory retrieval
      5. GLM Psychologist → psychological_analysis
      6. GLM Technique Selector → technique_selection
      7. GLM Response Generator → ai_response
      8. Return result in original format
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

        # ── Memory system ─────────────────────────────────────
        google_api_key = config.get_api_key("google") or os.getenv("GOOGLE_API_KEY", "")
        try:
            if google_api_key and self.feature_flags.get("background_memory_extraction", True):
                self.memory_system: Optional[UniversalMemorySystem] = UniversalMemorySystem(api_key=google_api_key)
                logger.info("✅ [WORKFLOW] Memory system ready")
            else:
                self.memory_system = None
        except Exception as e:
            self.memory_system = None
            logger.error(f"❌ [WORKFLOW] Memory system init failed: {e}")

        # ── Agents & controllers ──────────────────────────────
        self.groq_nlp: Optional[GroqNLPModule] = GroqNLPModule() if self.feature_flags.get("nlp_analysis", True) else None
        self.glm = GLMController()
        self.cultural_module: Optional[CulturalContextModule] = (
            CulturalContextModule(groq_nlp=self.groq_nlp) if self.feature_flags.get("cultural_context", True) else None
        )
        self.screening_agent: Optional[ScreeningAssessmentAgent] = (
            ScreeningAssessmentAgent(self.groq_nlp, self.glm) if self.feature_flags.get("screening_assessments", True) else None
        )
        self.agent_psychologist = PsychologistAnalysisAgent(self.glm)
        self.agent_technique = TechniqueSelectorAgent(self.glm)
        self.response_gen = ResponseGenerator(self.glm)

        # ── RAG components ────────────────────────────────────
        if self.feature_flags.get("rag_memory_retrieval", True):
            try:
                self.embedding_service: Optional[EmbeddingService] = EmbeddingService()
                self.query_agent: Optional[QueryDecisionAgent] = QueryDecisionAgent(
                    groq_client=self.groq_nlp.client if self.groq_nlp else None,
                    glm_controller=self.glm,
                )
                self.memory_retriever: Optional[MemoryRetriever] = MemoryRetriever(
                    supabase_client=self.supabase,
                    embedding_service=self.embedding_service,
                )
                self.memory_deduplicator: Optional[MemoryDeduplicator] = MemoryDeduplicator(
                    supabase_client=self.supabase,
                    embedding_service=self.embedding_service,
                )
                self.episodic_promoter: Optional[EpisodicPromoter] = EpisodicPromoter(
                    supabase_client=self.supabase,
                    embedding_service=self.embedding_service,
                    gemini_model=self.memory_system.model if self.memory_system else None,
                )
                logger.info("✅ [WORKFLOW] RAG memory system initialised")
            except Exception as e:
                logger.error(f"⚠️ [WORKFLOW] RAG init failed (non-blocking): {e}")
                self.embedding_service = self.query_agent = None
                self.memory_retriever = self.memory_deduplicator = self.episodic_promoter = None
        else:
            logger.info("ℹ️ [WORKFLOW] RAG memory retrieval disabled by config")
            self.embedding_service = self.query_agent = None
            self.memory_retriever = self.memory_deduplicator = self.episodic_promoter = None

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

    def _merge_contexts_with_llm(self, old_ctx: Dict, new_ctx: Dict) -> Dict:
        merged_base = self._merge_contexts_simple(old_ctx, new_ctx)
        refine_keys = ["nlp_analysis", "cultural_context", "psychological_analysis", "technique_selection", "screening_assessments"]
        old_focus = compact_for_merge_prompt({k: old_ctx.get(k) for k in refine_keys})
        new_focus = compact_for_merge_prompt({k: new_ctx.get(k) for k in refine_keys})

        prompt = (
            "Merge PREVIOUS and NEW therapeutic-analysis JSON blocks for the same user. "
            "Return ONLY valid JSON containing exactly these top-level keys: "
            "nlp_analysis, cultural_context, psychological_analysis, technique_selection, screening_assessments. "
            "Rules: preserve useful past insights, prefer NEW values when conflicting, no markdown.\n\n"
            f"PREVIOUS: {json.dumps(old_focus, ensure_ascii=True)}\n\n"
            f"NEW: {json.dumps(new_focus, ensure_ascii=True)}\n\nOutput JSON only."
        )

        refined: Optional[Dict] = None
        if self.groq_nlp and self.groq_nlp.client:
            try:
                resp = self.groq_nlp.client.chat.completions.create(
                    model=self.groq_nlp.model, messages=[{"role": "user", "content": prompt}], temperature=0.1, max_tokens=600
                )
                refined = parse_json_from_llm_output(resp.choices[0].message.content if resp.choices else "")
            except Exception as e:
                logger.info(f"ℹ️ [MERGE] Groq refinement skipped: {e}")

        if refined is None:
            try:
                glm_resp = self.glm.invoke([{"role": "user", "content": prompt}])
                refined = parse_json_from_llm_output(glm_resp.content if glm_resp else "")
            except Exception as e:
                logger.info(f"ℹ️ [MERGE] GLM refinement skipped: {e}")

        if isinstance(refined, dict):
            for key in refine_keys:
                val = refined.get(key)
                if isinstance(val, dict):
                    merged_base[key] = val
        return merged_base

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
                "session_id": context.get("session_id"),
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

            with ThreadPoolExecutor(max_workers=2) as executor:
                fut_existing = executor.submit(_read_existing)
                fut_screening = executor.submit(
                    self.screening_agent.generate, deepcopy(user_context)
                ) if self.screening_agent else None

                existing_ctx = fut_existing.result()
                screening_payload = fut_screening.result() if fut_screening else {}

            if screening_payload:
                user_context.setdefault("screening_assessments", {})
                user_context["screening_assessments"].update(screening_payload)

            merged_ctx = (
                self._merge_contexts_with_llm(existing_ctx, user_context)
                if existing_ctx is not None else user_context
            )

            with open(file_path, "w") as fh:
                json.dump(merged_ctx, fh, indent=4)

            self._save_user_context_to_supabase(merged_ctx)
            logger.info(f"✅ [FILE] UserContext saved to {file_path}")
        except Exception as e:
            logger.error(f"❌ [FILE] Failed to save user context: {e}")

    def fetch_session_memories(self, session_id: str) -> Dict[str, List[Dict]]:
        empty: Dict[str, List] = {"procedural": [], "semantic": [], "episodic": []}
        if not self.supabase or not session_id:
            return empty
        try:
            resp = (
                self.supabase.table("memories")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .execute()
            )
            if not resp.data:
                return empty
            memories: Dict[str, List] = {"procedural": [], "semantic": [], "episodic": []}
            for row in resp.data:
                for mem_type in ("procedural", "semantic", "episodic"):
                    raw = row.get(f"{mem_type}_memories", [])
                    if isinstance(raw, str):
                        try:
                            raw = json.loads(raw)
                        except Exception:
                            raw = []
                    for mem in (raw if isinstance(raw, list) else []):
                        memories[mem_type].append({
                            "memory_content": mem.get("memory_content", mem.get("content", str(mem))),
                            "confidence": mem.get("confidence", 0.5),
                            "created_at": row.get("created_at"),
                            "memory_id": row.get("id"),
                            "importance": mem.get("importance", "medium"),
                            "category": mem.get("category", "general"),
                        })
            total = sum(len(v) for v in memories.values())
            logger.info(f"✅ [FETCH_MEMORIES] {total} memories retrieved")
            return memories
        except Exception as e:
            logger.error(f"❌ [FETCH_MEMORIES] {e}")
            return empty

    def fetch_last_n_messages(self, session_id: str, n: int = 15) -> List[Dict]:
        if not self.supabase or not session_id:
            return []
        try:
            resp = (
                self.supabase.table("chat_messages")
                .select("id, role, content, created_at")
                .eq("session_id", session_id)
                .eq("processed_into_memory", False)
                .order("created_at", desc=False)
                .limit(n)
                .execute()
            )
            return [
                {"id": r["id"], "role": r["role"], "content": r["content"], "timestamp": r["created_at"]}
                for r in (resp.data or [])
            ]
        except Exception as e:
            logger.error(f"❌ [WORKFLOW] fetch_last_n_messages error: {e}")
            return []

    def trigger_memory_extraction(self, session_id: str, user_id: str) -> None:
        """Trigger legacy memory extraction (v1 compat)."""
        try:
            messages = self.fetch_last_n_messages(session_id, n=15)
            if not messages or not self.memory_system:
                return
            chat_data = {"data_type": "chat", "user_id": user_id, "session_id": session_id, "chat_history": messages}
            result = self.memory_system.process_data_to_memories(chat_data)
            memory_record = {
                "user_id": user_id,
                "session_id": session_id,
                "data_type": "chat",
                "procedural_memories": result["memories"].get("procedural", []),
                "semantic_memories": result["memories"].get("semantic", []),
                "episodic_memories": result["memories"].get("episodic", []),
                "memory_summary": {
                    "procedural_count": len(result["memories"].get("procedural", [])),
                    "semantic_count": len(result["memories"].get("semantic", [])),
                    "episodic_count": len(result["memories"].get("episodic", [])),
                    "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
                },
                "source_message_ids": [msg["id"] for msg in messages],
                "metadata": {"message_count": len(messages), "extraction_method": "parallel_llm"},
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
            if self.supabase:
                self.supabase.table("memories").insert(memory_record).execute()
                ids = [msg["id"] for msg in messages]
                if ids:
                    self.supabase.table("chat_messages").update({"processed_into_memory": True}).in_("id", ids).execute()
            logger.info("✅ [MEMORY EXTRACTION] Done")
        except Exception as e:
            logger.error(f"❌ [MEMORY EXTRACTION] Failed: {e}")

    def _background_unified_extraction(self, session_id: str, user_id: str, message_count: int) -> None:
        """Background worker for unified memory extraction (RAG system)."""
        try:
            logger.info(f"🧠 [UNIFIED_EXTRACTION] session={session_id[:8]} user={user_id} msgs={message_count}")
            messages = self.fetch_last_n_messages(session_id, n=12)
            if len(messages) < 12:
                return
            chunk_number = message_count // 12 - 1
            result = self.memory_system.extract_all_with_summary_unified(
                messages=messages, chunk_number=chunk_number, session_id=session_id
            )
            if self.supabase:
                try:
                    self.supabase.from_("session_chunk_summaries").insert({
                        "session_id": session_id, "user_id": user_id, "chunk_number": chunk_number,
                        "message_count": len(messages),
                        "summary_content": result["session_summary"]["summary"],
                        "emotional_progression": result["session_summary"]["emotional_progression"],
                        "key_themes": result["session_summary"]["key_themes"],
                        "source_message_ids": [msg["id"] for msg in messages],
                    }).execute()
                except Exception as e:
                    logger.error(f"❌ [UNIFIED_EXTRACTION] Summary save failed: {e}")

            saved_counts: Dict[str, int] = {"semantic": 0, "procedural": 0, "episodic": 0}
            for mem_type in ("semantic", "procedural", "episodic"):
                for memory in result["memories"].get(mem_type, []):
                    if self.memory_deduplicator:
                        mem_id = self.memory_deduplicator.process_and_save_memory(
                            memory=memory, session_id=session_id, user_id=user_id, memory_type=mem_type
                        )
                        if mem_id:
                            saved_counts[mem_type] += 1
                            if mem_type == "episodic" and self.episodic_promoter:
                                if self.episodic_promoter.track_and_promote(episodic=memory, session_id=session_id, user_id=user_id):
                                    pass  # promoted_count tracked if needed

            if self.supabase:
                ids = [msg["id"] for msg in messages]
                if ids:
                    self.supabase.from_("chat_messages").update({"processed_into_memory": True}).in_("id", ids).execute()

            logger.info(
                f"✅ [UNIFIED_EXTRACTION] semantic={saved_counts['semantic']} "
                f"procedural={saved_counts['procedural']} episodic={saved_counts['episodic']}"
            )
        except Exception as e:
            logger.error(f"❌ [UNIFIED_EXTRACTION] Failed: {e}")

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
    ) -> Dict[str, Any]:
        """Main processing pipeline — same signature & return format as original."""
        start_time = datetime.now()

        # Step 1: build context envelope
        ctx = create_empty_user_context(user_id, session_id, user_message.strip())
        ctx["voice_analysis"] = voice_analysis or {}
        ctx["session_context"]["recent_messages"] = recent_messages or []
        ctx["session_context"]["conversation_summary"] = conversation_summary or {}
        ctx["session_context"]["user_activities"] = user_activities or []
        ctx["session_context"]["user_patterns"] = user_patterns or {}

        # Steps 2-4: parallel memory fetch + NLP + cultural
        if self.feature_flags.get("parallel_processing", True):
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                fut_mem: Optional[Future] = executor.submit(self.fetch_session_memories, session_id) if session_id else None
                fut_nlp: Optional[Future] = executor.submit(self.groq_nlp.analyse, ctx) if self.groq_nlp else None
                fut_cul: Optional[Future] = executor.submit(self.cultural_module.analyse, ctx) if self.cultural_module else None

                for fut, label in [(fut_mem, "memory"), (fut_nlp, "NLP"), (fut_cul, "cultural")]:
                    if fut:
                        try:
                            result = fut.result()
                            if label == "memory":
                                ctx["session_context"]["session_memories"] = result
                        except Exception as e:
                            logger.error(f"❌ [PIPELINE] {label} error (non-fatal): {e}")
        else:
            if session_id:
                try:
                    ctx["session_context"]["session_memories"] = self.fetch_session_memories(session_id)
                except Exception as e:
                    logger.error(f"❌ [PIPELINE] Memory fetch error: {e}")
            if self.groq_nlp:
                try:
                    self.groq_nlp.analyse(ctx)
                except Exception as e:
                    logger.error(f"❌ [PIPELINE] NLP error: {e}")
            if self.cultural_module:
                try:
                    self.cultural_module.analyse(ctx)
                except Exception as e:
                    logger.error(f"❌ [PIPELINE] Cultural error: {e}")

        # Step 4.5: RAG retrieval
        if self.query_agent and self.memory_retriever and session_id:
            try:
                UUID(session_id)  # validate UUID format
                decision = self.query_agent.should_query_memories(
                    user_message=user_message,
                    recent_messages=recent_messages or [],
                    emotional_state=ctx["nlp_analysis"].get("emotional_state", {}),
                )
                if decision.get("needs_memory", False):
                    query = decision.get("query_hint", user_message)
                    embedding = self.embedding_service.embed_text(query)
                    retrieved = self.memory_retriever.retrieve_memories(
                        query=query, query_embedding=embedding,
                        memory_types=decision.get("memory_types", ["semantic", "procedural"]),
                        confidence_threshold=decision.get("confidence_threshold", 0.6),
                        user_id=user_id, session_id=session_id, top_k=5,
                    )
                    ctx["session_context"]["retrieved_memories"] = retrieved
                    logger.info(f"✅ [RAG] Retrieved {sum(len(v) for v in retrieved.values())} memories")
                else:
                    ctx["session_context"]["retrieved_memories"] = {"semantic": [], "procedural": [], "episodic": []}
            except ValueError:
                logger.warning(f"⚠️ [RAG] Invalid session_id format: {str(session_id)[:20]}")
                ctx["session_context"]["retrieved_memories"] = {"semantic": [], "procedural": [], "episodic": []}
            except Exception as e:
                logger.error(f"❌ [RAG] Memory retrieval failed (non-blocking): {e}")
                ctx["session_context"]["retrieved_memories"] = {"semantic": [], "procedural": [], "episodic": []}
        else:
            ctx["session_context"]["retrieved_memories"] = {"semantic": [], "procedural": [], "episodic": []}

        # Steps 5-7: GLM agents
        ctx = self.agent_psychologist.run(ctx)
        ctx = self.agent_technique.run(ctx)
        ctx = self.response_gen.generate(ctx)

        processing_time = (datetime.now() - start_time).total_seconds()

        # Step 8: fire-and-forget context save
        threading.Thread(
            target=self.save_user_context_to_file,
            args=(ctx, f"user_context_{ctx['user_id']}.json"),
            daemon=True,
        ).start()

        # Step 8.5: background memory extraction trigger
        if session_id and self.supabase and self.memory_system:
            try:
                count_result = (
                    self.supabase.from_("chat_messages")
                    .select("id", count="exact")
                    .eq("session_id", session_id)
                    .eq("processed_into_memory", False)
                    .execute()
                )
                unprocessed = count_result.count if hasattr(count_result, "count") else 0
                if unprocessed >= 12:
                    threading.Thread(
                        target=self._background_unified_extraction,
                        args=(session_id, user_id, unprocessed),
                        daemon=True,
                    ).start()
            except Exception as e:
                logger.error(f"❌ [BACKGROUND] Trigger check failed: {e}")

        psych = ctx["psychological_analysis"]
        technique = ctx["technique_selection"]

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
) -> Dict[str, Any]:
    """Public entry point — identical signature to original v1."""
    import time
    logger.info(f"🚀 [ENTRY] MindMitra v2 — user={user_id}, session={session_id}")
    start = time.time()
    try:
        workflow = get_workflow_instance()
        result = workflow.process_chat(
            user_message, recent_messages, conversation_summary,
            user_activities, user_patterns, voice_analysis, user_id, session_id,
        )
        result["processing_time"] = round(time.time() - start, 2)
        result["voice_aware"] = bool(voice_analysis)
        logger.info(f"✅ [ENTRY] Done in {result['processing_time']}s")
        return result
    except Exception as e:
        logger.error(f"❌ [ENTRY] Failed after {time.time()-start:.2f}s: {e}")
        raise
