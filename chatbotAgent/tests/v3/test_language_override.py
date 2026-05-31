"""Unit tests for user-selected response language plumbing.

Covers the four touch-points where the language preference travels:

  1. ``ChatRequest`` defensively coerces unknown / malformed values to ``None``.
  2. ``SessionObject`` serialises and deserialises ``response_language``,
     and an old payload without the key still loads cleanly.
  3. ``_render_tone_block`` keeps the Hinglish / None / unknown path
     byte-identical to the pre-change baseline, while each supported
     non-Hinglish language emits the override directive and drops the
     Hindi-English code-mix line.
  4. ``_tone_conformance`` skips the code-mix check when the override is
     active so a non-Devanagari response is not bounced into a retry.

These tests are pure-Python — no FastAPI, no Redis, no Groq.
"""
from __future__ import annotations

import json

import pytest

from app.api.chat_ws import ChatRequest, SUPPORTED_RESPONSE_LANGUAGES
from app.core.session import SessionObject
from app.models.signals import ToneParams
from app.pipeline.prompt_builder import _render_tone_block
from app.pipeline.safety_gate import _tone_conformance


# ── 1. ChatRequest coercion ─────────────────────────────────────────────
def test_chat_request_accepts_each_supported_language():
    for lang in SUPPORTED_RESPONSE_LANGUAGES:
        req = ChatRequest(content="hi", language=lang)
        assert req.language == lang


def test_chat_request_normalises_case_and_whitespace():
    req = ChatRequest(content="hi", language="  English  ")
    assert req.language == "english"


def test_chat_request_coerces_unknown_to_none():
    # Unknown values must not 400 — chat must keep flowing.
    req = ChatRequest(content="hi", language="klingon")
    assert req.language is None


def test_chat_request_treats_missing_or_empty_as_none():
    assert ChatRequest(content="hi").language is None
    assert ChatRequest(content="hi", language="").language is None
    assert ChatRequest(content="hi", language=None).language is None


# ── 2. SessionObject persistence ────────────────────────────────────────
def test_session_round_trip_preserves_response_language():
    s = SessionObject(session_id="s1", user_id="u1", response_language="tamil")
    rehydrated = SessionObject.from_json(s.to_json())
    assert rehydrated.response_language == "tamil"


def test_session_without_response_language_field_still_loads():
    """Old Redis payloads predating this field must keep deserialising."""
    payload = {
        "session_id": "s1",
        "user_id": "u1",
        "started_at": "2026-05-25T10:00:00+00:00",
        "last_activity": "2026-05-25T10:00:00+00:00",
        "status": "active",
        "turn_count": 0,
        "current_mode": "companion",
        "mode_history": [],
        "affect_history": [],
        "urgency_history": [],
        "turns": [],
        "language_register": "casual",
        "code_mix_ratio": 0.5,
        "dependency_signals": {"sessions_this_week": 0, "social_mentions_count": 0},
        "cultural_frame_id": "metro_social",
        "longitudinal_risk_flag": False,
        "session_peak_urgency": 0,
        "llm_tokens_used": 0,
        "semantic_profile": {},
        "procedural_profile": {},
    }
    s = SessionObject.from_json(json.dumps(payload))
    assert s.response_language is None


# ── 3. Tone-block rendering ─────────────────────────────────────────────
def _baseline_tone() -> ToneParams:
    return ToneParams()  # default-constructed: code_mix=0.5, etc.


def test_tone_block_hinglish_baseline_unchanged_for_none():
    """The Hinglish / None / unknown path must be byte-identical to today."""
    tone = _baseline_tone()
    rendered = _render_tone_block(tone, urgency_floor=False, response_language=None)
    assert "Hindi-English code-mix: ~50% Hindi tokens." in rendered
    assert "Respond ONLY" not in rendered
    assert "language directive overrides" not in rendered


def test_tone_block_explicit_hinglish_matches_none_path():
    tone = _baseline_tone()
    a = _render_tone_block(tone, urgency_floor=False, response_language=None)
    b = _render_tone_block(tone, urgency_floor=False, response_language="hinglish")
    assert a == b


def test_tone_block_unknown_language_falls_back_to_hinglish():
    tone = _baseline_tone()
    a = _render_tone_block(tone, urgency_floor=False, response_language=None)
    b = _render_tone_block(tone, urgency_floor=False, response_language="klingon")
    assert a == b


@pytest.mark.parametrize(
    "language,expected_marker",
    [
        ("english",  "ONLY in English"),
        ("hindi",    "ONLY in Hindi"),
        ("japanese", "ONLY in Japanese"),
        ("telugu",   "ONLY in Telugu"),
        ("kannada",  "ONLY in Kannada"),
        ("tamil",    "ONLY in Tamil"),
    ],
)
def test_tone_block_emits_directive_per_language(language, expected_marker):
    tone = _baseline_tone()
    rendered = _render_tone_block(tone, urgency_floor=False, response_language=language)
    assert expected_marker in rendered
    assert "Hindi-English code-mix" not in rendered
    assert "language directive overrides" in rendered


def test_tone_block_preserves_urgency_and_humour_lines_with_override():
    """Override must not regress unrelated conditional lines."""
    tone = ToneParams(humour_tolerance=0.6, directness=0.2, emoji_use=0.1)
    rendered = _render_tone_block(tone, urgency_floor=True, response_language="english")
    assert "Never offer solutions" in rendered
    assert "Light humour is OK" in rendered
    assert "Soften direct statements" in rendered
    assert "Avoid emojis" in rendered


# ── 4. Safety-gate code-mix skip ────────────────────────────────────────
def test_tone_conformance_penalises_english_response_when_skip_off():
    """Baseline behaviour: an English-only reply with code_mix=0.5 loses
    points on the code-mix check. This test is the negative control."""
    tone = ToneParams(code_mix=0.5)
    # ~12 words per sentence keeps the length penalty off; only code-mix fires.
    english = (
        "I hear you and that sounds really exhausting and unfair right now. "
        "That kind of weight is hard to carry alone every single day."
    )
    score = _tone_conformance(english, tone, "companion", skip_code_mix=False)
    # With sentence length OK, only the code-mix penalty fires → 1.0 - 0.25.
    assert score == pytest.approx(0.75)


def test_tone_conformance_skips_code_mix_when_language_override_active():
    tone = ToneParams(code_mix=0.5)
    english = (
        "I hear you and that sounds really exhausting and unfair right now. "
        "That kind of weight is hard to carry alone every single day."
    )
    score = _tone_conformance(english, tone, "companion", skip_code_mix=True)
    # With code-mix skipped and sentence length within target, no penalty.
    assert score == pytest.approx(1.0)


def test_tone_conformance_still_checks_sentence_length_with_skip():
    """Skipping code-mix must NOT skip sentence-length enforcement."""
    tone = ToneParams(code_mix=0.5, sentence_length=0.2)  # target ~6 words
    too_long = (
        "I want to say that I really appreciate you opening up to me about "
        "this incredibly difficult situation and I think we should explore "
        "the underlying patterns together at length."
    )
    score = _tone_conformance(too_long, tone, "companion", skip_code_mix=True)
    assert score < 1.0


# ── 5. Crisis-template variant resolution ───────────────────────────────
import asyncio

from app.core import fallback as fb_mod
from app.pipeline.crisis_bypass import resolve_crisis_variant, select_language_variant


@pytest.mark.parametrize(
    "language,expected",
    [
        ("english", "en"),
        ("hindi", "hi"),
        ("tamil", "en"),
        ("telugu", "en"),
        ("kannada", "en"),
        ("japanese", "en"),
        ("  English  ", "en"),  # whitespace / case tolerated
    ],
)
def test_resolve_crisis_variant_honours_explicit_language(language, expected):
    # code_mix_ratio is high (would otherwise pick "hi") — the explicit
    # language must win, falling back to English where no clinician template
    # exists for that language.
    assert resolve_crisis_variant(0.9, language) == expected


def test_resolve_crisis_variant_hinglish_uses_code_mix_table():
    # "hinglish" is NOT in the explicit map → code-mix-driven selection.
    assert resolve_crisis_variant(0.1, "hinglish") == "en"
    assert resolve_crisis_variant(0.6, "hinglish") == "hinglish_casual"


def test_resolve_crisis_variant_none_and_unknown_preserve_baseline():
    assert resolve_crisis_variant(0.0) == select_language_variant(0.0)
    assert resolve_crisis_variant(0.95) == select_language_variant(0.95)
    assert resolve_crisis_variant(0.6, "klingon") == select_language_variant(0.6)


# ── 6. Static-fallback variant resolution ───────────────────────────────
def _captured_static_variant(monkeypatch, *, code_mix_ratio, response_language):
    """Run select_static_fallback with a stubbed Supabase fetch and return
    the variant string it asked for on the first lookup."""
    captured: list[str] = []

    async def fake_fetch(mode, variant, idx):
        captured.append(variant)
        return "FALLBACK"

    monkeypatch.setattr(fb_mod.profile_service, "fetch_static_fallback", fake_fetch)
    out = asyncio.run(
        fb_mod.select_static_fallback(
            session_id="s1",
            turn_count=0,
            mode="companion",
            code_mix_ratio=code_mix_ratio,
            response_language=response_language,
        )
    )
    assert out == "FALLBACK"
    return captured[0]


@pytest.mark.parametrize(
    "language,code_mix,expected_variant",
    [
        ("english", 0.9, "en"),
        ("hindi", 0.0, "hinglish_casual"),  # no pure-Hindi static template
        ("tamil", 0.9, "en"),
        ("telugu", 0.9, "en"),
        ("kannada", 0.9, "en"),
        ("japanese", 0.9, "en"),
    ],
)
def test_static_fallback_honours_language(monkeypatch, language, code_mix, expected_variant):
    assert _captured_static_variant(
        monkeypatch, code_mix_ratio=code_mix, response_language=language
    ) == expected_variant


def test_static_fallback_none_and_hinglish_use_code_mix_tiers(monkeypatch):
    assert _captured_static_variant(
        monkeypatch, code_mix_ratio=0.6, response_language=None
    ) == "hinglish_casual"
    assert _captured_static_variant(
        monkeypatch, code_mix_ratio=0.3, response_language="hinglish"
    ) == "hinglish_formal"
    assert _captured_static_variant(
        monkeypatch, code_mix_ratio=0.0, response_language="hinglish"
    ) == "en"
