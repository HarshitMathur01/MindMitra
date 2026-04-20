"""Phase 1 — helplines registry sanity (offline)."""
from __future__ import annotations

import pytest


def test_registry_loads():
    from app.services.helplines import all_helplines
    rows = all_helplines()
    assert len(rows) >= 4, "at least 4 verified helplines expected"


def test_every_helpline_has_required_fields():
    from app.services.helplines import all_helplines
    for h in all_helplines():
        assert h.name and h.phone and h.phone_display
        assert h.languages, f"{h.id} has no languages listed"
        assert h.hours, f"{h.id} has no hours"
        assert h.modality in {"phone", "chat", "both"}
        assert h.country == "IN"


def test_default_user_gets_a_24x7_line():
    from app.services.helplines import for_user
    rows = for_user(language="en", audience="all", limit=3)
    assert any(h.hours == "24x7" for h in rows), "must always include a 24x7 helpline"


def test_hindi_user_gets_a_hindi_capable_line():
    from app.services.helplines import for_user
    rows = for_user(language="hi", audience="all", limit=3)
    assert any("hi" in h.languages for h in rows)


def test_render_block_is_non_empty():
    from app.services.helplines import render_helplines_block
    block = render_helplines_block(language="en", audience="all")
    assert "📞" in block and "\n" in block
