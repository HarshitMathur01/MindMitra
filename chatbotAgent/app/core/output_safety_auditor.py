"""
Post-generation safety audit (rule-based, non-blocking).

Not a substitute for CrisisManager real-time gating. Intended for logging and
quality signals. TODO: persist to Supabase safety_audit_log table when ready.
"""
from __future__ import annotations

import logging
import re
import threading
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


class OutputSafetyAuditor:
    """Regex-only audit of model output; runs off the hot path via daemon thread."""

    HARM_PATTERNS: List[Tuple[str, str]] = [
        ("self_harm_method", r"\b(cut(ting)?|overdose|pills to|hang(ing)? yourself|jump from)\b"),
        ("specific_method_detail", r"\b(lethal dose|how to die|best way to (kill|end))\b"),
        ("dismissive_minimization", r"\b(just cheer up|it's not that bad|stop being|snap out of)\b"),
        ("unsolicited_diagnosis", r"\b(you have|you suffer from|you are (depressed|anxious|bipolar))\b"),
        ("false_safety_claim", r"\b(I can always help|I am here for you 24|I will never|I can replace)\b"),
    ]

    def __init__(self) -> None:
        self._compiled: List[Tuple[str, re.Pattern[str]]] = [
            (name, re.compile(pattern, re.IGNORECASE)) for name, pattern in self.HARM_PATTERNS
        ]

    def audit(self, response_text: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
        violations: List[str] = []
        text = response_text or ""
        for name, pattern in self._compiled:
            if pattern.search(text):
                violations.append(name)

        severity = "none"
        if violations:
            severity = (
                "critical"
                if any(
                    v in violations for v in ("self_harm_method", "specific_method_detail")
                )
                else "warning"
            )
        passed = severity != "critical"

        return {
            "passed": passed,
            "violations": violations,
            "severity": severity,
            "response_length": len(text),
            "session_id": str(ctx.get("session_id") or ""),
            "user_id": str(ctx.get("user_id") or ""),
        }

    def run_async(self, response_text: str, ctx: Dict[str, Any], logger_instance: logging.Logger) -> None:
        """Run audit in a daemon thread; never raises to caller."""

        def _work() -> None:
            try:
                result = self.audit(response_text, ctx)
                if result["severity"] == "critical":
                    logger_instance.error(
                        "[SAFETY-AUDIT] Critical violation detected: %s session=%s",
                        result["violations"],
                        result["session_id"],
                    )
                elif result["severity"] == "warning":
                    logger_instance.warning(
                        "[SAFETY-AUDIT] Warning: %s session=%s",
                        result["violations"],
                        result["session_id"],
                    )
                # TODO: write to Supabase safety_audit_log table
            except Exception as exc:  # pragma: no cover - defensive
                logger_instance.exception("[SAFETY-AUDIT] audit thread failed: %s", exc)

        threading.Thread(target=_work, daemon=True, name="safety-audit").start()
