"""Post-stream OutputSafetyAuditor and EmotionalArcUpdater (no LLM / no DB)."""
from __future__ import annotations

import logging
import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from app.core.emotional_arc_updater import EmotionalArcUpdater
from app.core.output_safety_auditor import OutputSafetyAuditor


@pytest.fixture
def auditor():
    return OutputSafetyAuditor()


def test_auditor_passes_clean_response(auditor):
    r = auditor.audit("I hear you. That sounds really hard.", {})
    assert r["passed"] is True
    assert r["violations"] == []
    assert r["severity"] == "none"


def test_auditor_catches_self_harm_method(auditor):
    r = auditor.audit("You could try cutting to release tension", {})
    assert "self_harm_method" in r["violations"]
    assert r["severity"] == "critical"


def test_auditor_catches_dismissive(auditor):
    r = auditor.audit("Just cheer up, it's not that bad", {})
    assert "dismissive_minimization" in r["violations"]
    assert r["severity"] == "warning"


def test_auditor_catches_unsolicited_diagnosis(auditor):
    r = auditor.audit("You have depression based on what you said", {})
    assert "unsolicited_diagnosis" in r["violations"]


def test_auditor_critical_fails(auditor):
    r = auditor.audit("here is a lethal dose for you", {})
    assert r["passed"] is False
    assert r["severity"] == "critical"


def test_auditor_warning_passes(auditor):
    r = auditor.audit("Just cheer up already", {})
    assert r["passed"] is True
    assert r["severity"] == "warning"


def test_auditor_empty_response(auditor):
    r = auditor.audit("", {"session_id": "s", "user_id": "u"})
    assert r["passed"] is True
    assert r["violations"] == []


def test_arc_updater_compute_sentiment():
    up = EmotionalArcUpdater()
    v = up.compute_response_sentiment("That sounds really hard and I'm sorry you're going through this")
    assert -1.0 <= v <= 1.0


def test_arc_updater_positive_response_scores_positive():
    up = EmotionalArcUpdater()
    assert up.compute_response_sentiment("You're doing great and I'm proud of you") > 0.0


def test_arc_updater_no_exception_on_empty():
    up = EmotionalArcUpdater()
    up.compute_response_sentiment("")


def test_safety_auditor_threads_are_daemon():
    log = logging.getLogger("test-safety")
    with patch("app.core.output_safety_auditor.threading.Thread") as mock_thread:
        mock_thread.return_value = MagicMock()
        auditor = OutputSafetyAuditor()
        auditor.run_async("hello", {"session_id": "1", "user_id": "u"}, log)
    mock_thread.assert_called_once()
    _, kwargs = mock_thread.call_args
    assert kwargs.get("daemon") is True


def test_run_async_swallows_audit_exception():
    log = logging.getLogger("test-safety-2")
    auditor = OutputSafetyAuditor()
    with patch.object(auditor, "audit", side_effect=RuntimeError("boom")):
        auditor.run_async("x", {}, log)
    time.sleep(0.05)


def test_arc_update_async_swallows_exception():
    log = logging.getLogger("test-arc")
    up = EmotionalArcUpdater()
    with patch.object(up, "compute_response_sentiment", side_effect=RuntimeError("boom")):
        up.update_async("user", "resp", {"session_id": "s"}, None, log)
    time.sleep(0.05)
