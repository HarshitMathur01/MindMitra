"""Authentication helpers for HTTP routes and the disabled legacy WebSocket.

Therapist bridge still uses ``validate_user_token`` with Supabase's auth
client. The MHA HTTP chat runtime uses ``decode_supabase_jwt`` against
``SUPABASE_JWT_SECRET``.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import HTTPException, WebSocket, WebSocketDisconnect, status

from .env import env

logger = logging.getLogger(__name__)

class AuthError(Exception):
    """Raised when Supabase JWT validation fails."""


def decode_supabase_jwt(token: str) -> str:
    """Decode a Supabase JWT and return the auth user UUID (``sub``)."""
    e = env()
    if not e.supabase_jwt_secret:
        raise AuthError("SUPABASE_JWT_SECRET not configured")
    try:
        from jose import jwt

        claims = jwt.decode(
            token,
            e.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
        sub = claims.get("sub")
        if not sub:
            raise AuthError("JWT missing sub claim")
        return str(sub)
    except Exception as exc:  # noqa: BLE001
        raise AuthError(f"JWT decode failed: {exc}") from exc


async def authenticate_websocket(websocket: WebSocket) -> Optional[str]:
    """Return the Supabase auth UUID, or close the socket and return None."""
    e = env()

    auth_header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[len("Bearer "):].strip()
        try:
            uid = decode_supabase_jwt(token)
            await websocket.accept()
            logger.info("[auth] header JWT accepted uid=%.8s", uid)
            return uid
        except AuthError as exc:
            logger.warning("[auth] header JWT rejected: %s", exc)

    await websocket.accept()

    timeout_s = e.auth_frame_timeout_skip_auth_s if e.skip_auth_effective else e.auth_frame_timeout_s
    first: Optional[dict] = None
    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=timeout_s)
        if isinstance(raw, dict):
            first = raw
    except asyncio.TimeoutError:
        if e.skip_auth_effective:
            logger.warning(
                "[auth] SKIP_AUTH: no auth frame within %.0fs — using DEV_USER_ID",
                timeout_s,
            )
            return e.dev_user_id
        logger.warning("[auth] auth frame timeout after %.0fs — closing connection", timeout_s)
        await websocket.send_json({"type": "auth_error", "code": 4001, "message": "Authentication required"})
        await websocket.close(code=4001)
        return None
    except WebSocketDisconnect:
        logger.info("[auth] client disconnected during auth handshake")
        return None
    except Exception as exc:  # noqa: BLE001
        if e.skip_auth_effective:
            logger.warning("[auth] SKIP_AUTH: first-message read failed (%s) — using DEV_USER_ID", exc)
            return e.dev_user_id
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    if first and first.get("type") == "auth":
        token = (first.get("token") or "").strip()
        if token:
            try:
                uid = decode_supabase_jwt(token)
                logger.info("[auth] first-message JWT accepted uid=%.8s", uid)
                return uid
            except AuthError as exc:
                logger.warning("[auth] first-message JWT rejected: %s", exc)
        else:
            logger.debug("[auth] auth frame received but token is empty")
    elif first:
        logger.warning(
            "[auth] unexpected first frame type=%r — message consumed, client should send auth first",
            first.get("type"),
        )

    if e.skip_auth_effective:
        logger.warning("[auth] SKIP_AUTH active — using DEV_USER_ID=%.8s", e.dev_user_id)
        return e.dev_user_id

    logger.warning("[auth] authentication failed — closing connection")
    await websocket.send_json({"type": "auth_error", "code": 4001, "message": "Authentication required"})
    await websocket.close(code=4001)
    return None


async def validate_user_token(
    authorization: Optional[str],
    supabase_client,  # supabase.Client — typed loosely to avoid hard dep at import time
) -> str:
    """
    Validate a JWT Bearer token and return the authenticated user_id.

    Supports a development bypass controlled by the ``SKIP_AUTH`` env variable.
    If ``SKIP_AUTH`` is truthy the function returns ``DEV_USER_ID`` without
    validating the token at all.

    Raises:
        HTTPException 401 – missing / invalid / expired token.
        HTTPException 500 – auth service unavailable (Supabase not initialised).
    """
    e = env()
    if e.skip_auth_effective:
        logger.warning("⚠️ [AUTH] SKIP_AUTH enabled – bypassing token validation (local dev)")
        return e.dev_user_id

    if not authorization:
        logger.error("❌ [AUTH] No authorization header provided")
        raise HTTPException(status_code=401, detail="Authorization header required")

    if not authorization.startswith("Bearer "):
        logger.error("❌ [AUTH] Invalid authorization format")
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization.removeprefix("Bearer ")

    if not supabase_client:
        logger.error("❌ [AUTH] Supabase client not initialised")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

    try:
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not getattr(user_response, "user", None):
            logger.error("❌ [AUTH] Invalid token – user not found")
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id: str = user_response.user.id
        logger.info(f"✅ [AUTH] User authenticated: {user_id}")
        return user_id

    except HTTPException:
        raise  # re-raise cleanly
    except Exception as e:
        logger.error(f"❌ [AUTH] Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
