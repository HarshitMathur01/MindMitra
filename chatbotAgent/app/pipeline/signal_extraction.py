"""Layer 2 — Signal extraction (Groq Llama 3.1 8B + structured JSON).

The Groq call returns the 7 fields specified in v3 (affect_vector,
urgency_score, language_register, code_mix_ratio, sarcasm_detected,
implicit_distress_signals, topic_keywords). All seven have at least one
declared consumer; ``sarcasm_detected``/``implicit_distress_signals``/
``topic_keywords`` and friends — see ``app/pipeline/orchestrator.py``.

Post-processing is pure Python:
  * longitudinal_risk_flag escalation (urgency += 1 when already >=1)
  * passive monitor (farewell / hopelessness count / shutdown)
  * sarcasm dampening (urgency -= 1, floor 0) for the Orchestrator
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Dict, List, Optional

from ..core.connections import get_groq, record_failure, record_success
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..models.signals import (
    AffectVector,
    GroqSignalRaw,
    IngestedInput,
    PassiveSignals,
    Signals,
)

logger = get_logger(__name__)


# ── Groq structured-output prompt ────────────────────────────────────────
_SCHEMA_INSTRUCTION = (
    "You are an emotion + risk signal extractor for an Indian Hindi-English "
    "code-mixed mental-health chat. Read the user's MOST RECENT message in "
    "context of the conversation history. Return ONLY a strict JSON object "
    "matching this schema (no markdown, no prose):\n"
    "{\n"
    '  "affect_vector": {"valence": float[-1..1], "arousal": float[0..1], "dominance": float[0..1]},\n'
    '  "urgency_score": int (0=routine, 1=elevated distress, 2=high distress, 3=imminent crisis/self-harm),\n'
    '  "language_register": "formal"|"semi_formal"|"casual"|"slang",\n'
    '  "code_mix_ratio": float[0..1] (0=pure English, 1=pure Hindi),\n'
    '  "sarcasm_detected": bool,\n'
    '  "implicit_distress_signals": [strings like "farewell_pattern","hopelessness_indirect","numbness","social_withdrawal"],\n'
    '  "topic_keywords": [up to 6 short keywords or named entities]\n'
    "}\n"
    "Rules:\n"
    " - urgency_score=3 ONLY for explicit suicidality/self-harm intent or imminent danger (current language).\n"
    " - Treat sarcasm as a flag, do NOT lower urgency in your output (that happens downstream).\n"
    " - Hindi 'khatam ho gaya' / 'sab khatam' / 'jeena nahi chahta' / 'mar jaun' family of phrases → urgency >= 2.\n"
    " - Return valid JSON — no preface, no trailing commas, no comments."
)


_FAREWELL_PATTERNS = (
    r"\bgoodbye\b",
    r"\btake care of yourself\b",
    r"\bthis is the last\b",
    r"\bi(?:'| a)m done\b",
    r"\balvida\b",
    r"\bbye(?:[\s,.!]|$)",
    r"miss me",
)
_HOPELESS_PATTERNS = (
    r"\bnothing (?:will|can) (?:ever )?get better\b",
    r"\bwhat'?s the point\b",
    r"\bno way out\b",
    r"\bkoi (?:matlab|fayda) nahi\b",
    r"\bumeed nahi\b",
    r"\bkuch nahi badle?ga\b",
    r"\bhopeless\b",
)


# ── public entry ─────────────────────────────────────────────────────────
async def extract_signals(
    ingested: IngestedInput,
    *,
    session: SessionObject,
    trace_id: str | None = None,
) -> Signals:
    trace_id = trace_id or ingested.trace_id
    e = env()
    turns_sent = len(session.recent_user_messages(6))
    logger.info(
        "→ Groq extraction",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            model=e.groq_signal_model,
            turns_sent=turns_sent,
            affect_vectors_sent=len(session.recent_affect(5)),
            risk_flag=session.longitudinal_risk_flag,
        ),
    )
    started = time.perf_counter()
    raw: Optional[GroqSignalRaw] = await _call_groq(ingested.normalised_message, session)
    latency_ms = (time.perf_counter() - started) * 1000.0

    fallback_used = raw is None
    if raw is None:
        raw = _fallback_raw(session)
        logger.warning(
            "signal extraction degraded — using last known state",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                trace_id=trace_id,
                fallback="last_known_urgency",
                degraded=True,
                latency_ms=latency_ms,
            ),
        )
    else:
        logger.info(
            "← Groq complete",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                trace_id=trace_id,
                latency_ms=latency_ms,
                urgency=raw.urgency_score,
                valence=round(raw.affect_vector.valence, 2),
                arousal=round(raw.affect_vector.arousal, 2),
                dominance=round(raw.affect_vector.dominance, 2),
                sarcasm=raw.sarcasm_detected,
            ),
        )

    # Passive monitor (Python rules)
    passive = _passive_monitor(ingested.normalised_message, session)

    urgency = raw.urgency_score
    urgency_before_passive = urgency
    if passive.farewell_detected and urgency < 2:
        urgency = max(urgency, 2)
    if passive.hopelessness_count >= 3 and urgency < 2:
        urgency = max(urgency, 2)
    logger.info(
        "passive monitor complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            farewell_detected=passive.farewell_detected,
            hopelessness_count=passive.hopelessness_count,
            sudden_shutdown=passive.sudden_shutdown,
            topic_drop=passive.topic_drop,
            urgency_before=urgency_before_passive,
            urgency_after=urgency,
            triggered=urgency != urgency_before_passive,
        ),
    )

    # Longitudinal risk escalates one tier when already non-zero
    if session.longitudinal_risk_flag and urgency >= 1:
        before = urgency
        urgency = min(3, urgency + 1)
        logger.info(
            f"urgency adjusted {before}→{urgency} (longitudinal risk flag active)",
            extra=log_context(session_id=session.session_id, user_id=session.user_id, trace_id=trace_id, risk_flag=True),
        )

    return Signals(
        affect_vector=raw.affect_vector,
        urgency_score=urgency,
        language_register=raw.language_register,
        code_mix_ratio=raw.code_mix_ratio,
        sarcasm_detected=raw.sarcasm_detected,
        implicit_distress_signals=list(set(raw.implicit_distress_signals + passive_to_signal_names(passive))),
        topic_keywords=raw.topic_keywords,
        passive_signals=passive,
        fallback_used=fallback_used,
        extraction_latency_ms=latency_ms,
    )


def passive_to_signal_names(passive: PassiveSignals) -> List[str]:
    out: List[str] = []
    if passive.farewell_detected:
        out.append("farewell_pattern")
    if passive.hopelessness_count:
        out.append(f"hopelessness_x{passive.hopelessness_count}")
    if passive.sudden_shutdown:
        out.append("sudden_shutdown")
    if passive.topic_drop:
        out.append("topic_drop")
    return out


# ── Groq call ────────────────────────────────────────────────────────────
async def _call_groq(message: str, session: SessionObject) -> Optional[GroqSignalRaw]:
    client = get_groq()
    if client is None:
        logger.warning(
            "Groq client unavailable; signal fallback required",
            extra=log_context(session_id=session.session_id, user_id=session.user_id, fallback="rule_based"),
        )
        return None
    e = env()

    history_block = _format_history(session.recent_user_messages(6))
    affect_block = _format_recent_affect(session.recent_affect(5))

    user_payload = (
        "CONVERSATION HISTORY (most-recent last):\n"
        f"{history_block}\n\n"
        "RECENT AFFECT/URGENCY HISTORY:\n"
        f"{affect_block}\n\n"
        "USER BASELINE: "
        f"{json.dumps(session.semantic_profile.get('language_baseline', {}), ensure_ascii=False)}\n"
        f"LONGITUDINAL_RISK_FLAG={session.longitudinal_risk_flag}\n\n"
        "MESSAGE TO ANALYSE:\n"
        f"{message}"
    )

    # Use asyncio.wait_for directly for a strict wall-clock total timeout.
    # guarded_call's internal wait_for can't fire when the event loop is
    # delayed; this outer wrapper guarantees we never block longer than
    # e.groq_timeout_s regardless of Groq server behaviour.
    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=e.groq_signal_model,
                messages=[
                    {"role": "system", "content": _SCHEMA_INSTRUCTION},
                    {"role": "user", "content": user_payload},
                ],
                temperature=0.2,
                max_tokens=256,
                response_format={"type": "json_object"},
            ),
            timeout=e.groq_timeout_s,
        )
        record_success("groq")
        content = response.choices[0].message.content or "{}"
    except asyncio.TimeoutError:
        logger.warning(
            "Groq signal extraction timed out",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                timeout_s=e.groq_timeout_s,
                fallback="rule_based",
                degraded=True,
            ),
        )
        record_failure("groq", "timeout")
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Groq signal call failed",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                exception_type=type(exc).__name__,
                error=str(exc),
                fallback="rule_based",
                degraded=True,
            ),
        )
        record_failure("groq", exc)
        return None

    try:
        return GroqSignalRaw.model_validate_json(content)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Groq signal response failed validation",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                exception_type=type(exc).__name__,
                fallback="schema_coercion",
                degraded=True,
            ),
        )
        # Best-effort dict load to salvage urgency-only
        try:
            data = json.loads(content)
            return GroqSignalRaw.model_validate(_coerce_to_schema(data))
        except Exception:  # noqa: BLE001
            return None


def _coerce_to_schema(data: Dict[str, Any]) -> Dict[str, Any]:
    av = data.get("affect_vector") or {}
    return {
        "affect_vector": {
            "valence": float(av.get("valence", 0.0)),
            "arousal": float(av.get("arousal", 0.3)),
            "dominance": float(av.get("dominance", 0.5)),
        },
        "urgency_score": int(data.get("urgency_score", 0)),
        "language_register": data.get("language_register", "casual"),
        "code_mix_ratio": float(data.get("code_mix_ratio", 0.5)),
        "sarcasm_detected": bool(data.get("sarcasm_detected", False)),
        "implicit_distress_signals": list(data.get("implicit_distress_signals") or []),
        "topic_keywords": list(data.get("topic_keywords") or []),
    }


# ── fallbacks + passive monitor ──────────────────────────────────────────
def _fallback_raw(session: SessionObject) -> GroqSignalRaw:
    last_urgency = session.urgency_history[-1] if session.urgency_history else 0
    return GroqSignalRaw(
        affect_vector=AffectVector(valence=0.0, arousal=0.3, dominance=0.5),
        urgency_score=last_urgency,
        language_register="casual",
        code_mix_ratio=session.code_mix_ratio,
        sarcasm_detected=False,
        implicit_distress_signals=["signal_extraction_failed"],
        topic_keywords=[],
    )


def _passive_monitor(message: str, session: SessionObject) -> PassiveSignals:
    text = (message or "").lower()
    farewell = any(re.search(p, text) for p in _FAREWELL_PATTERNS)
    recent_texts = [m.lower() for m in session.recent_user_messages(4)]
    recent_texts.append(text)
    recent_texts = recent_texts[-5:]
    hopeless_count = sum(
        1
        for msg in recent_texts
        for pattern in _HOPELESS_PATTERNS
        if re.search(pattern, msg)
    )

    # Detect shutdown: 3+ user msgs in row where length is dropping fast.
    # Include the current message because it has not been appended to Redis yet.
    user_msgs = session.recent_user_messages(3) + [message or ""]
    shutdown = False
    if len(user_msgs) >= 3:
        lens = [len(m) for m in user_msgs[-3:]]
        if lens[-1] < 12 and lens[-1] <= lens[-2] // 2:
            shutdown = True

    topic_drop = False  # left for the orchestrator (needs topic continuity check)
    return PassiveSignals(
        farewell_detected=farewell,
        hopelessness_count=hopeless_count,
        sudden_shutdown=shutdown,
        topic_drop=topic_drop,
    )


def _format_history(messages: List[str]) -> str:
    if not messages:
        return "(no prior turns this session)"
    return "\n".join(f"- {m}" for m in messages)


def _format_recent_affect(affect: List[Dict[str, Any]]) -> str:
    if not affect:
        return "(none)"
    return "\n".join(
        f"- v={a.get('valence', 0):.2f} a={a.get('arousal', 0):.2f} d={a.get('dominance', 0):.2f} u={a.get('urgency', 0)}"
        for a in affect
    )
