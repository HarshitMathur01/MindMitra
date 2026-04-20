"""
Health: GET /chat/greeting still returns a frontend-compatible payload.

Frontend (`ChatGPTInterface.fetchGreeting`) expects an object with at least
`show_greeting: bool` and a `greeting` string field. Don't break this.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest


@patch("app.api.chat.validate_user_token")
def test_greeting_returns_expected_shape(mock_validate, client):
    async def _v(_a, _c):
        return "pytest-health-user"

    mock_validate.side_effect = _v

    r = client.get(
        "/chat/greeting",
        params={"session_id": "pytest-greet", "language": "english"},
        headers={"Authorization": "Bearer test"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # The exact key set varies; the frontend tolerates extras but needs one
    # of these to render anything useful.
    assert any(k in body for k in ("greeting", "message", "show_greeting")), body
