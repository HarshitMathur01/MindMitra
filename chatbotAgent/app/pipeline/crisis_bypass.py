"""Layer 2B — Crisis bypass.

When ``urgency_score == 3`` we MUST:
  1. select a language-variant template from Supabase ``crisis_templates``
     (active=true, latest version)
  2. fall back to the hardcoded ``CRISIS_HARDCODED_*`` env strings if
     Supabase is unreachable or has no matching active row
  3. write a non-blocking audit log entry
  4. return immediately — Orchestrator / Retrieval / LLM / Safety gate are
     all SKIPPED.

No LLM call participates in this path. Ever.
"""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, Optional

from ..core.env import env
from ..core.logging import get_logger, log_context
from ..models.signals import CrisisResponse
from ..services import profile_service

logger = get_logger(__name__)


def select_language_variant(code_mix_ratio: float) -> str:
    """Pick a crisis template language variant from the spec's table."""
    r = max(0.0, min(1.0, float(code_mix_ratio)))
    if r < 0.2:
        return "en"
    if r < 0.5:
        return "hinglish_formal"
    if r < 0.8:
        return "hinglish_casual"
    return "hi"


async def crisis_bypass_check(
    *,
    urgency_score: int,
    user_id: str,
    session_id: str,
    code_mix_ratio: float,
    trace_id: str | None = None,
    audit_logger: Optional[Callable[[dict], Awaitable[None]]] = None,
) -> Optional[CrisisResponse]:
    if urgency_score != 3:
        return None

    variant = select_language_variant(code_mix_ratio)
    logger.warning(
        "━━━━━━ CRISIS TIER 3 ━━━━━━",
        extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, urgency=urgency_score, template_variant=variant),
    )
    logger.warning(
        "CRISIS BYPASS FIRED",
        extra=log_context(
            session_id=session_id,
            user_id=user_id,
            trace_id=trace_id,
            urgency=urgency_score,
            template_variant=variant,
            code_mix_ratio=code_mix_ratio,
            why="tier3_urgency",
        ),
    )
    content = await profile_service.fetch_active_crisis_template(variant)
    source = "supabase" if content else "hardcoded"
    if not content:
        e = env()
        content = e.crisis_hardcoded_hi if variant in ("hi", "hinglish_casual") else e.crisis_hardcoded_en
        logger.warning(
            "crisis template fetch failed; using hardcoded fallback",
            extra=log_context(
                session_id=session_id,
                user_id=user_id,
                trace_id=trace_id,
                template_variant=variant,
                outcome="hardcoded_fallback",
            ),
        )
    else:
        logger.warning(
            "crisis template fetch succeeded",
            extra=log_context(
                session_id=session_id,
                user_id=user_id,
                trace_id=trace_id,
                template_variant=variant,
                source=source,
                outcome="template_loaded",
            ),
        )

    # Audit log — fire and forget
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "event_type": "tier3_trigger",
        "urgency_score": 3,
        "mode": "crisis_bypass",
        "memory_used": False,
        "tokens_used": 0,
        "llm_used": "none",
        "safety_flags": {"tier3": True, "variant": variant, "template_source": source},
        "extra": {"trace_id": trace_id} if trace_id else None,
    }
    if audit_logger is not None:
        asyncio.create_task(audit_logger(payload))
    else:
        asyncio.create_task(profile_service.write_audit_log(payload))
    logger.warning(
        "audit entry write scheduled",
        extra=log_context(
            session_id=session_id,
            user_id=user_id,
            trace_id=trace_id,
            event_type="tier3_trigger",
            async_task=True,
            outcome="scheduled",
        ),
    )
    logger.warning(
        "LLM SKIPPED — crisis template served",
        extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, llm_called=False, outcome="bypassed"),
    )

    return CrisisResponse(
        content=content,
        language_variant=variant,
        source=source,
    )
