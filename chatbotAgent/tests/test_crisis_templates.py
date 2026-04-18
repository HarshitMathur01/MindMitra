"""Tests for static crisis_templates (no LLM, no network)."""
from __future__ import annotations

from types import SimpleNamespace

from app.core.crisis_templates import build_warm_crisis_response, get_crisis_template
from app.pipeline.crisis_manager import CrisisManager


def test_get_template_hard_en():
    t = get_crisis_template("en", "hard")
    assert "iCall" in t
    assert "9152987821" in t


def test_get_template_elevated_en():
    t = get_crisis_template("en", "elevated")
    assert "iCall" in t
    assert "I'm really glad you said something right now" not in t


def test_get_template_hinglish():
    t = get_crisis_template("hinglish", "hard")
    assert "Yaar" in t
    assert "glad" in t.lower()


def test_get_template_hindi():
    t = get_crisis_template("hi", "hard")
    assert "iCall" in t


def test_get_template_tamil():
    t = get_crisis_template("ta", "hard")
    assert "iCall" in t


def test_get_template_unknown_language_falls_back():
    t = get_crisis_template("fr", "hard")
    assert isinstance(t, str)
    assert len(t) > 0


def test_get_template_unknown_severity_falls_back():
    t = get_crisis_template("en", "unknown")
    assert "I'm really glad you said something right now" in t


def test_build_warm_crisis_response_uses_language_from_ctx():
    ctx = {"content_locale": "hi"}
    text = build_warm_crisis_response(ctx, None)
    # Elevated Hindi template
    assert "Jo tumne abhi share kiya" in text
    assert "iCall" in text


def test_build_warm_crisis_response_cognitive_crisis_uses_hard():
    ctx = {"language_preference": "en"}
    cog = SimpleNamespace(risk_level="crisis")
    text = build_warm_crisis_response(ctx, cog)
    assert "I'm really glad you said something right now" in text


def test_build_warm_crisis_response_no_cognitive_uses_elevated():
    ctx = {"language_preference": "en"}
    text = build_warm_crisis_response(ctx, None)
    assert "Hey — I'm noticing something" in text


def test_build_warm_crisis_response_template_severity_hard_without_cognitive():
    ctx = {"language_preference": "en"}
    text = build_warm_crisis_response(ctx, None, template_severity="hard")
    assert "I'm really glad you said something right now" in text


def test_all_templates_contain_hotlines():
    for lang in ("en", "hi", "hinglish", "ta"):
        for sev in ("hard", "elevated"):
            t = get_crisis_template(lang, sev)
            assert "9152987821" in t


def test_no_template_is_empty():
    for lang in ("en", "hi", "hinglish", "ta"):
        for sev in ("hard", "elevated"):
            assert len(get_crisis_template(lang, sev)) > 100


def test_crisis_manager_build_warm_delegates():
    mgr = CrisisManager(groq_nlp=None, supabase=None)
    ctx = {"language_preference": "en"}
    out = mgr.build_warm_crisis_response(ctx, None)
    assert "Hey — I'm noticing something" in out
