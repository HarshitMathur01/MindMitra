"""
Flag-gated dispatcher between legacy `process_user_chat` and the new
`MitraPipeline`. Default: master flag OFF → legacy path is used unchanged.

When `MITRA_STACK_ENABLED=1`, this function lazily builds the MITRA pipeline
on first use, runs it, and adapts the result to the legacy dict shape so the
SSE/JSON contract on `/chat` and `/chat/stream` is byte-identical.

When `MITRA_DUAL_TRACK_ENABLED=1` we wire `DualTrackGenerator` (fast Groq
listener + parallel deep model) instead of the single-pass generator.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable, Dict, List, Optional

from ...core.logging import log_banner
from ...core.models import FeatureFlags, ModelRegistry, Role
from ...core.prompts.stance import Stage

logger = logging.getLogger("app.mitra.dispatch")


_PIPELINE_LOCK = threading.Lock()
_PIPELINE: Optional[Any] = None


def _make_llm_caller(role: Role) -> Callable[..., Any]:
    """Return an async callable matching `LLMCompleteFn` for the given role.

    The MITRA generators expect:
        async def llm(*, system: str, user: str,
                       stream_callback: Optional[Callable[[str], None]] = None) -> str

    When `stream_callback` is provided AND the provider supports streaming we
    iterate the async chunk iterator and push each delta to the callback so
    the user sees tokens as they arrive. Otherwise we do a single blocking
    completion and (best-effort) emit the full text at the end.
    """
    async def _llm(*, system: str, user: str,
                   stream_callback: Optional[Callable[[str], None]] = None) -> str:
        from ...providers import get_llm_provider
        cfg = ModelRegistry.for_role(role)
        provider = get_llm_provider(cfg.provider.value)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        # Streaming path — only providers that implement it (Azure, Gemini).
        if stream_callback and getattr(provider, "name", "") in ("azure_openai", "gemini"):
            try:
                stream_iter = await provider.complete(
                    messages,
                    model=cfg.model,
                    max_tokens=cfg.max_tokens,
                    temperature=cfg.temperature,
                    timeout_s=cfg.timeout_s,
                    stream=True,
                )
                pieces: list[str] = []
                async for delta in stream_iter:
                    if not delta:
                        continue
                    pieces.append(delta)
                    try:
                        stream_callback(delta)
                    except Exception:  # noqa: BLE001
                        pass
                return "".join(pieces)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Streaming LLM call (%s) failed (%s); falling back to blocking",
                    cfg.provider.value, exc,
                )

        # Blocking path (default).
        try:
            result = await provider.complete(
                messages,
                model=cfg.model,
                max_tokens=cfg.max_tokens,
                temperature=cfg.temperature,
                timeout_s=cfg.timeout_s,
                stream=False,
            )
            text = result if isinstance(result, str) else str(result or "")
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM call (%s) failed: %s", cfg.provider.value, exc)
            text = ""

        # Best-effort one-shot stream emit so SSE clients still see something.
        if stream_callback and text:
            try:
                stream_callback(text)
            except Exception:  # noqa: BLE001
                pass
        return text

    return _llm


def _build_pipeline_lazy() -> Any:
    """Construct a MitraPipeline with real services. Imports inside to avoid
    paying the cost when the master flag is off."""
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    with _PIPELINE_LOCK:
        if _PIPELINE is not None:
            return _PIPELINE

        # Local imports — keep cold-path light.
        from .classifier import IntentClassifier
        from .retriever import RetrieverOrchestrator
        from .assembler import ContextAssembler
        from .generator import TwoPassGenerator
        from .dual_track import DualTrackGenerator
        from .orchestrator import MitraPipeline
        from ...memory.working import WorkingMemoryStore

        identity = trace_repo = preferences = relationship = None
        crisis_event_sink = None
        try:
            from ...services.supabase_service import supabase_client
            from ...memory.repositories import TurnTraceRepo
            from ...memory.identity_card import IdentityCardService
            from ...memory.preferences import PreferencesService
            from ...memory.relationship_state import RelationshipStateService
            if supabase_client:
                identity = IdentityCardService(supabase_client)
                trace_repo = TurnTraceRepo(supabase_client)
                preferences = PreferencesService(supabase_client)
                relationship = RelationshipStateService(supabase_client)

                def _crisis_sink(row: Dict[str, Any]) -> None:
                    try:
                        supabase_client.table("crisis_events").insert(row).execute()
                    except Exception as ex:  # noqa: BLE001
                        logger.warning("crisis_events insert failed: %s", ex)

                crisis_event_sink = _crisis_sink
        except Exception as exc:  # noqa: BLE001
            logger.warning("identity/trace/prefs/relationship bind failed: %s", exc)

        # Crisis confirmer — small, fast Groq Llama-8B by default.
        async def _crisis_confirmer(*, text: str) -> bool:
            from ...providers import get_llm_provider
            from ...core.prompts.crisis import (
                CRISIS_CONFIRMER_SYSTEM, build_confirmer_user_msg,
            )
            cfg = ModelRegistry.for_role(Role.CRISIS_CONFIRMER)
            provider = get_llm_provider(cfg.provider.value)
            messages = [
                {"role": "system", "content": CRISIS_CONFIRMER_SYSTEM},
                {"role": "user", "content": build_confirmer_user_msg(text)},
            ]
            try:
                out = await provider.complete(
                    messages, model=cfg.model,
                    max_tokens=cfg.max_tokens, temperature=cfg.temperature,
                    timeout_s=cfg.timeout_s, stream=False,
                )
                token = (out if isinstance(out, str) else str(out or "")).strip().upper()
                return token.startswith("CRISIS")
            except Exception as exc:  # noqa: BLE001
                logger.warning("crisis confirmer LLM failed (failing closed): %s", exc)
                return True

        retriever = RetrieverOrchestrator(
            identity_service=identity,
            episodic_service=None,           # Phase 2: bind once embedder is ready
            affective_service=None,
            relational_service=None,
            procedural_service=None,
            preferences_service=preferences,
            deadline_ms=int(os.getenv("MITRA_RETRIEVE_DEADLINE_MS", "250")),
        )

        if FeatureFlags.mitra_dual_track_enabled():
            generator = DualTrackGenerator(
                llm_fast=_make_llm_caller(Role.GENERATOR_SPECULATIVE),
                llm_deep=_make_llm_caller(Role.GENERATOR_PRIMARY),
                track_b_deadline_ms=int(os.getenv("MITRA_TRACK_B_DEADLINE_MS", "1800")),
            )
        else:
            generator = TwoPassGenerator(
                llm_complete=_make_llm_caller(Role.GENERATOR_PRIMARY),
            )

        _PIPELINE = MitraPipeline(
            classifier=IntentClassifier(),
            retriever=retriever,
            assembler=ContextAssembler(),
            generator=generator,
            relationship_state=relationship,
            trace_repo=trace_repo,
            working_memory=WorkingMemoryStore(),
            crisis_confirmer=_crisis_confirmer,
            crisis_event_sink=crisis_event_sink,
        )

        log_banner(
            "🧠 MITRA PIPELINE READY",
            [
                f"generator   : {'dual-track' if FeatureFlags.mitra_dual_track_enabled() else 'two-pass'}",
                f"identity    : {'on' if identity else 'off'}",
                f"trace_repo  : {'on' if trace_repo else 'off'}",
                f"preferences : {'on' if preferences else 'off'}",
                f"relationship: {'on' if relationship else 'off'}",
                f"crisis_sink : {'on' if crisis_event_sink else 'off'}",
            ],
            logger=logger,
        )
        return _PIPELINE


def is_enabled() -> bool:
    return FeatureFlags.mitra_stack_enabled()


async def run_mitra_turn(
    *,
    user_message: str,
    user_id: str,
    session_id: str,
    recent_messages: Optional[List[Dict[str, str]]] = None,
    persona: str = "mitra",
    language: str = "en",
    stage: Stage = Stage.STRANGER,
    user_preferred_name: Optional[str] = None,
    stream_callback: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Run one MITRA turn and return the legacy `process_user_chat` dict shape."""
    from .orchestrator import TurnInput

    pipeline = _build_pipeline_lazy()
    result = await pipeline.process_turn(
        TurnInput(
            user_id=user_id,
            session_id=session_id,
            user_message=user_message,
            recent_turns=list(recent_messages or []),
            persona=persona,
            language=language,
            stage=stage,
            user_preferred_name=user_preferred_name,
        ),
        stream_callback=stream_callback,
    )
    return {
        "message": result.message,
        "modality": result.modality,
        "confidence": result.confidence,
        "session_insights": {
            "intent": result.classification.intent.value if result.classification else None,
            "stance": result.stance,
            "is_crisis": result.is_crisis,
            "used_episodes": result.used_episodes,
            "accepted_on_pass": result.accepted_on_pass,
            "fallback_used": result.fallback_used,
            "timings_ms": result.timings_ms,
        },
        "eval_trace": result.debug if FeatureFlags.allow_eval_trace() else None,
    }


def reset_pipeline_for_tests() -> None:
    """Test helper — wipes the lazy singleton so tests can re-bind services."""
    global _PIPELINE
    with _PIPELINE_LOCK:
        _PIPELINE = None
