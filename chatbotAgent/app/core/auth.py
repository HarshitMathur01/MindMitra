"""
Authentication helpers — JWT validation via Supabase.
"""
import os
import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Development auth bypass (SKIP_AUTH=true skips token validation locally)
SKIP_AUTH: bool = os.getenv("SKIP_AUTH", "false").lower() in ("1", "true", "yes")
DEV_USER_ID: str = os.getenv("DEV_USER_ID", "a0778b19-548f-47df-8413-296307566d0f")
_ensured_dev_user_row: bool = False


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
    if SKIP_AUTH:
        logger.warning("⚠️ [AUTH] SKIP_AUTH enabled – bypassing token validation (local dev)")
        global _ensured_dev_user_row
        if not _ensured_dev_user_row and supabase_client:
            try:
                # Prevent downstream FK failures (e.g. crisis_events.user_id → users.id)
                # when using a DEV_USER_ID that doesn't exist in the public users table.
                supabase_client.table("users").upsert({"id": DEV_USER_ID}, on_conflict="id").execute()
                _ensured_dev_user_row = True
                logger.info("✅ [AUTH] Ensured DEV user row exists | user=%s", DEV_USER_ID[:12])
            except Exception as exc:
                # Best-effort: if schema differs or table missing, don't block dev chat.
                logger.debug("[AUTH] DEV user row ensure failed: %s", exc)
        return DEV_USER_ID

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
