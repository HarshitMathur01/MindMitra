"""Layer 7 — Output safety gate.

Runs AFTER the LLM finishes streaming. Five checks:

  1. Harm classifier (Groq, combined call with check 2)
  2. Sycophancy classifier (Groq, same call → saves ~150ms vs two calls)
  3. Semantic hallucination (Phase 2 only — KB RAG; skipped in MVP)
  4. Tone conformance (Python rule-based)
  5. Length check (Python ``len``)

On harm: regenerate up to 2 times with lowered temperature + explicit
"do not" instruction → after 2 retries, replace with static fallback.

On sycophancy: regenerate once with anti-sycophancy rewrite instruction.

On tone fail: regenerate once with tone-correction instruction.

On length fail: truncate at last sentence boundary; no regeneration.

The caller is responsible for replacing the final response when
``SafetyResult.approved`` is False.
"""
from __future__ import annotations

import json
import re
import statistics
import time
from typing import Awaitable, Callable, Dict, List, Optional, Tuple

from ..core.connections import get_groq, guarded_call
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..models.signals import (
    OrchestratorOutput,
    SafetyFlags,
    SafetyResult,
    Signals,
    ToneParams,
)

logger = get_logger(__name__)


COMBINED_PROMPT = (
    "Classify this agent reply for a mental-health chat with an Indian young "
    "adult. Return STRICT JSON only:\n"
    "{\n"
    '  "harm": bool,\n'
    '  "harm_category": string|null,\n'
    '  "sycophancy": bool,\n'
    '  "sycophancy_type": string|null\n'
    "}\n"
    "Harm = self-harm facilitation OR clinical diagnostic language OR advice "
    "contradicting safe messaging OR reproduction of private info OR explicit "
    "mention of suicide methods.\n"
    "Sycophancy = validating cognitive distortions, amplifying catastrophising, "
    "or agreeing that the situation is hopeless. Reflecting emotions is NOT "
    "sycophancy."
)

CONFORMANCE_THRESHOLD = 0.65
LENGTH_OVERSIZE_MULT = 1.2
MIN_LENGTH_TOKENS = 10
# active_listener mode instructs the model to use 1-3 sentences; a single
# short sentence is 3-5 words and is clinically correct for that mode.
# Other modes are held to the full 10-word floor.
MIN_LENGTH_BY_MODE: dict[str, int] = {"active_listener": 3}

SOLUTION_KEYWORDS = (
    "try ",
    "you should",
    "have you considered",
    "maybe you could",
    "what you can do",
    "i suggest",
    "i'd recommend",
)

_HINDI_TOKEN_RE = re.compile(r"[\u0900-\u097F]+")
_LATIN_TOKEN_RE = re.compile(r"[A-Za-z']+")


# ── public entry ─────────────────────────────────────────────────────────
async def run_safety_gate(
    *,
    raw_response: str,
    orchestrator: OrchestratorOutput,
    signals: Signals,
    finish_reason: str,
    regenerate: Callable[[str, float], Awaitable[str]],
    static_fallback: Callable[[], Awaitable[str]],
    trace_id: str | None = None,
) -> SafetyResult:
    """Run all checks against ``raw_response``.

    Parameters
    ----------
    regenerate
        Async callable ``regenerate(prepend_instruction, temperature) -> str``.
        Used to retry the LLM with a tweaked prompt.
    static_fallback
        Async callable returning a static fallback template string for the
        current mode/language variant. Called when retries are exhausted.
    """
    # ── Azure content_filter short-circuits straight to static fallback ──
    if finish_reason == "content_filter":
        logger.warning("Azure content_filter received — safety gate bypassing to static fallback", extra=log_context(trace_id=trace_id, outcome="static_fallback"))
        fallback = await static_fallback()
        flags = SafetyFlags(harm=True, harm_category="azure_content_filter")
        logger.info("checks complete", extra=log_context(trace_id=trace_id, harm=True, syco=False, conformance=1.0, length="ok", source="static_fallback", retries=0, outcome="fallback"))
        return SafetyResult(
            approved=False,
            approved_response=fallback,
            safety_flags=flags,
            safety_check_result=_result_dict(flags, 1.0, True, 0, "static_fallback"),
            retries_used=0,
            response_source="static_fallback",
            conformance_score=1.0,
        )

    if not raw_response.strip():
        logger.warning("empty LLM response — static fallback selected", extra=log_context(trace_id=trace_id, outcome="static_fallback"))
        fallback = await static_fallback()
        flags = SafetyFlags()
        logger.info("checks complete", extra=log_context(trace_id=trace_id, harm=False, syco=False, conformance=1.0, length="too_short", source="static_fallback", retries=0, outcome="fallback"))
        return SafetyResult(
            approved=False,
            approved_response=fallback,
            safety_flags=flags,
            safety_check_result=_result_dict(flags, 1.0, False, 0, "static_fallback"),
            retries_used=0,
            response_source="static_fallback",
            conformance_score=1.0,
        )

    current = raw_response
    flags = SafetyFlags()
    safety_classifier_degraded = False
    retries = 0
    source: str = "llm_primary"

    # ── Check 1+2: combined Groq harm + sycophancy ──────────────────────
    for attempt in range(2):  # up to 2 harm retries
        classified = await _classify_harm_sycophancy(current, trace_id=trace_id)
        if classified is None:
            flags = SafetyFlags(harm=None, sycophancy=None, hallucination=False)
            safety_classifier_degraded = True
            logger.warning(
                "safety Groq unavailable — applying Python-only checks and allowing response",
                extra=log_context(trace_id=trace_id, safety_flags={"harm": None, "sycophancy": None}, outcome="degraded_allow"),
            )
            break
        flags = classified
        logger.debug(
            "check 1+2 complete",
            extra=log_context(
                trace_id=trace_id,
                harm=flags.harm,
                harm_category=flags.harm_category or "none",
                syco=flags.sycophancy,
                sycophancy_type=flags.sycophancy_type or "none",
                attempt=attempt + 1,
            ),
        )
        if not flags.harm:
            break
        logger.warning(
            "retry triggered",
            extra=log_context(trace_id=trace_id, check="harm", corrective_instruction="safe_messaging_no_methods_no_diagnosis", attempt=attempt + 1),
        )
        new = await regenerate(
            "The previous response may have caused harm. Rewrite it strictly within "
            "safe messaging guidelines. Do NOT mention methods, do NOT validate "
            "self-harm intent, do NOT use clinical diagnostic vocabulary.",
            max(0.2, orchestrator.temperature - 0.15),
        )
        retries += 1
        source = "llm_retry"
        if not new.strip():
            break
        current = new

    if flags.harm:
        logger.warning(
            "fallback triggered",
            extra=log_context(trace_id=trace_id, check="harm", mode=orchestrator.selected_mode, retries=retries, template_index="deterministic"),
        )
        fallback = await static_fallback()
        logger.info("checks complete", extra=log_context(trace_id=trace_id, harm=True, syco=flags.sycophancy, conformance=0.0, length="ok", source="static_fallback", retries=retries, outcome="fallback"))
        return SafetyResult(
            approved=False,
            approved_response=fallback,
            safety_flags=flags,
            safety_check_result=_result_dict(flags, 0.0, True, retries, "static_fallback"),
            retries_used=retries,
            response_source="static_fallback",
            conformance_score=0.0,
        )

    # ── Check 3: hallucination / KB-grounding ────────────────────────────
    # TODO(phase-2): Enable semantic hallucination checks once KB RAG is live.
    # MVP has no psychoeducation/knowledge-base context, so this check is
    # intentionally skipped rather than making an extra unsupported LLM call.

    # ── Sycophancy retry (max 1) ────────────────────────────────────────
    if flags.sycophancy and not safety_classifier_degraded:
        logger.warning(
            "retry triggered",
            extra=log_context(trace_id=trace_id, check="sycophancy", corrective_instruction="reflect_without_affirming_distortion"),
        )
        new = await regenerate(
            "The previous response over-validated a distortion. Rewrite it to reflect "
            "the emotion without affirming the distorted belief. Stay concrete to the "
            "user's actual words.",
            orchestrator.temperature,
        )
        retries += 1
        source = "llm_retry"
        if new.strip():
            current = new
            flags2 = await _classify_harm_sycophancy(current, trace_id=trace_id)
            if flags2:
                flags = flags2

    # ── Check 4: tone conformance ───────────────────────────────────────
    # Skip the code-mix portion when the user explicitly picked a non-Hinglish
    # response language — the _HINDI_TOKEN_RE only matches Devanagari and
    # would otherwise force a regeneration toward Hindi-English code-mix.
    language_override_active = bool(
        orchestrator.response_language
        and orchestrator.response_language != "hinglish"
    )
    conformance = _tone_conformance(
        current,
        orchestrator.tone_params,
        orchestrator.selected_mode,
        skip_code_mix=language_override_active,
    )
    tone_details = _tone_check_details(current, orchestrator.tone_params, orchestrator.selected_mode)
    logger.debug(
        "check 4 tone complete",
        extra=log_context(trace_id=trace_id, conformance_score=conformance, passed=conformance >= CONFORMANCE_THRESHOLD, **tone_details),
    )
    if conformance < CONFORMANCE_THRESHOLD and not safety_classifier_degraded:
        logger.warning(
            "retry triggered",
            extra=log_context(trace_id=trace_id, check="tone", corrective_instruction="match_style_guide", conformance_score=conformance),
        )
        if language_override_active:
            corrective = (
                "Rewrite the reply to better match the style guide (sentence "
                "length, mode constraints). Keep the meaning and keep the "
                "language fixed to what the style guide requires."
            )
        else:
            corrective = (
                "Rewrite the reply to better match the style guide (code-mix, "
                "sentence length, mode constraints). Keep the meaning, change "
                "only the tone."
            )
        new = await regenerate(corrective, orchestrator.temperature)
        retries += 1
        source = "llm_retry"
        if new.strip():
            current = new
            conformance = _tone_conformance(
                current,
                orchestrator.tone_params,
                orchestrator.selected_mode,
                skip_code_mix=language_override_active,
            )
            tone_details = _tone_check_details(current, orchestrator.tone_params, orchestrator.selected_mode)

    # ── Check 5: length ─────────────────────────────────────────────────
    current, length_ok = _length_check(current, orchestrator.max_response_tokens)
    approx_tokens = _approx_token_count(current)
    min_len = MIN_LENGTH_BY_MODE.get(orchestrator.selected_mode, MIN_LENGTH_TOKENS)
    logger.debug(
        "check 5 length complete",
        extra=log_context(trace_id=trace_id, token_count=approx_tokens, min_len=min_len, max_tokens=orchestrator.max_response_tokens, length="ok" if length_ok else "too_short", truncated=approx_tokens > orchestrator.max_response_tokens * LENGTH_OVERSIZE_MULT),
    )
    if not length_ok and approx_tokens < min_len:
        logger.warning(
            "retry triggered",
            extra=log_context(trace_id=trace_id, check="length", mode=orchestrator.selected_mode, token_count=approx_tokens, min_len=min_len),
        )
        new = await regenerate(
            "Your response was too short. Write at least 2-3 complete sentences — "
            "reflect the user's emotion, acknowledge what they shared, and invite "
            "them to continue. Keep the same tone and mode.",
            orchestrator.temperature,
        )
        retries += 1
        source = "llm_retry"
        if new.strip() and _approx_token_count(new) >= min_len:
            current = new
            conformance = _tone_conformance(
                current,
                orchestrator.tone_params,
                orchestrator.selected_mode,
                skip_code_mix=language_override_active,
            )
        else:
            logger.warning(
                "fallback triggered",
                extra=log_context(trace_id=trace_id, check="length", mode=orchestrator.selected_mode, template_index="deterministic", token_count=_approx_token_count(new) if new.strip() else 0),
            )
            fallback = await static_fallback()
            logger.info("checks complete", extra=log_context(trace_id=trace_id, harm=flags.harm, syco=flags.sycophancy, conformance=conformance, length="too_short", source="static_fallback", retries=retries, outcome="fallback"))
            return SafetyResult(
                approved=False,
                approved_response=fallback,
                safety_flags=flags,
                safety_check_result=_result_dict(flags, conformance, False, retries, "static_fallback"),
                retries_used=retries,
                response_source="static_fallback",
                conformance_score=conformance,
            )

    result = SafetyResult(
        approved=True,
        approved_response=current,
        safety_flags=flags,
        safety_check_result=_result_dict(flags, conformance, length_ok, retries, source),
        retries_used=retries,
        response_source=source,  # type: ignore[arg-type]
        conformance_score=conformance,
    )
    logger.info(
        "checks complete",
        extra=log_context(
            harm=flags.harm,
            trace_id=trace_id,
            syco=flags.sycophancy,
            conformance=conformance,
            length="ok" if length_ok else "too_short",
            source=source,
            retries=retries,
            outcome="approved",
        ),
    )
    return result


# ── Combined Groq classifier ─────────────────────────────────────────────
async def _classify_harm_sycophancy(text: str, *, trace_id: str | None = None) -> Optional[SafetyFlags]:
    client = get_groq()
    if client is None:
        logger.warning("Groq safety classifier unavailable", extra=log_context(trace_id=trace_id, outcome="classifier_skipped"))
        return None
    e = env()
    started = time.perf_counter()
    try:
        resp = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_safety_model,
                messages=[
                    {"role": "system", "content": COMBINED_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0.0,
                max_tokens=200,
                response_format={"type": "json_object"},
            ),
            timeout_s=5.0,
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        latency_ms = (time.perf_counter() - started) * 1000.0
        logger.debug(
            "Groq combined classifier complete",
            extra=log_context(trace_id=trace_id, latency_ms=latency_ms, model=e.groq_safety_model),
        )
        return SafetyFlags(
            harm=bool(data.get("harm")),
            harm_category=data.get("harm_category"),
            sycophancy=bool(data.get("sycophancy")),
            sycophancy_type=data.get("sycophancy_type"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Groq combined classifier failed",
            extra=log_context(trace_id=trace_id, exception_type=type(exc).__name__, reason=str(exc), outcome="classifier_skipped"),
        )
        return None


# ── Check 4: tone conformance ────────────────────────────────────────────
def _tone_conformance(
    text: str,
    tone: ToneParams,
    mode: str,
    *,
    skip_code_mix: bool = False,
) -> float:
    score = 1.0

    if not skip_code_mix:
        hindi_tokens = len(_HINDI_TOKEN_RE.findall(text))
        latin_tokens = len(_LATIN_TOKEN_RE.findall(text))
        total = hindi_tokens + latin_tokens
        actual_code_mix = (hindi_tokens / total) if total else tone.code_mix
        if abs(actual_code_mix - tone.code_mix) > 0.25:
            score -= 0.25

    # Sentence length
    sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if s.strip()]
    if sentences:
        avg_words = statistics.fmean(len(s.split()) for s in sentences)
        target_words = 6 if tone.sentence_length < 0.4 else 12 if tone.sentence_length < 0.7 else 20
        if abs(avg_words - target_words) / max(target_words, 1) > 0.4:
            score -= 0.15

    if mode == "active_listener":
        if text.count("?") > 1:
            score -= 0.25
        lower = text.lower()
        if any(kw in lower for kw in SOLUTION_KEYWORDS):
            score -= 0.25

    return max(0.0, min(1.0, score))


def _tone_check_details(text: str, tone: ToneParams, mode: str) -> Dict[str, object]:
    hindi_tokens = len(_HINDI_TOKEN_RE.findall(text))
    latin_tokens = len(_LATIN_TOKEN_RE.findall(text))
    total = hindi_tokens + latin_tokens
    actual_code_mix = (hindi_tokens / total) if total else tone.code_mix
    sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if s.strip()]
    avg_words = statistics.fmean(len(s.split()) for s in sentences) if sentences else 0.0
    target_words = 6 if tone.sentence_length < 0.4 else 12 if tone.sentence_length < 0.7 else 20
    lower = text.lower()
    return {
        "code_mix_ok": abs(actual_code_mix - tone.code_mix) <= 0.25,
        "sentence_length_ok": (not sentences) or abs(avg_words - target_words) / max(target_words, 1) <= 0.4,
        "question_count_ok": mode != "active_listener" or text.count("?") <= 1,
        "solution_language_ok": mode != "active_listener" or not any(kw in lower for kw in SOLUTION_KEYWORDS),
        "actual_code_mix": round(actual_code_mix, 2),
        "avg_sentence_words": round(avg_words, 1),
    }


# ── Check 5: length ──────────────────────────────────────────────────────
def _length_check(text: str, max_tokens: int) -> Tuple[str, bool]:
    approx = _approx_token_count(text)
    if approx < MIN_LENGTH_TOKENS:
        return text, False
    if approx > max_tokens * LENGTH_OVERSIZE_MULT:
        return _truncate_at_sentence(text, max_tokens), True
    return text, True


def _truncate_at_sentence(text: str, max_tokens: int) -> str:
    target_chars = int(max_tokens * 4)  # ~4 chars per token heuristic
    if len(text) <= target_chars:
        return text
    truncated = text[:target_chars]
    last_sentence = max(truncated.rfind("."), truncated.rfind("!"), truncated.rfind("?"))
    if last_sentence > 0:
        return truncated[: last_sentence + 1]
    return truncated.rstrip() + "…"


def _approx_token_count(text: str) -> int:
    return max(1, len((text or "").strip().split()))


def _result_dict(
    flags: SafetyFlags,
    conformance_score: float,
    length_ok: bool,
    retries_used: int,
    final_source: str,
) -> Dict[str, object]:
    return {
        "harm": flags.harm,
        "harm_category": flags.harm_category,
        "sycophancy": flags.sycophancy,
        "sycophancy_type": flags.sycophancy_type,
        "hallucination": flags.hallucination,
        "conformance_score": conformance_score,
        "length_ok": length_ok,
        "retries_used": retries_used,
        "final_source": final_source,
    }
