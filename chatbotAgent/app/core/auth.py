"""
Authentication helpers — JWT validation via Supabase.
"""
import os
import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Development auth bypass (SKIP_AUTH=true skips token validation locally).
#
# SECURITY: a stray ``SKIP_AUTH=true`` in production trivially turns every
# request into ``DEV_USER_ID``. We accept the bypass only when the deployment
# environment is clearly non-production, OR when the operator explicitly
# acknowledges the risk via ``ALLOW_INSECURE_SKIP_AUTH=true``. In every other
# case we ignore the flag and force real JWT validation, with a loud log so
# misconfigurations are immediately visible in startup output.
_RAW_SKIP_AUTH: bool = os.getenv("SKIP_AUTH", "false").lower() in ("1", "true", "yes")
_ENV_NAME: str = os.getenv("ENV", os.getenv("ENVIRONMENT", "")).strip().lower()
_IS_NON_PROD_ENV: bool = _ENV_NAME in ("", "dev", "development", "local", "test", "testing")
_INSECURE_OVERRIDE: bool = (
    os.getenv("ALLOW_INSECURE_SKIP_AUTH", "false").lower() in ("1", "true", "yes")
)
SKIP_AUTH: bool = _RAW_SKIP_AUTH and (_IS_NON_PROD_ENV or _INSECURE_OVERRIDE)

if _RAW_SKIP_AUTH and not SKIP_AUTH:
    logger.error(
        "🚨 [AUTH] SKIP_AUTH=true ignored because ENV=%r looks like production. "
        "Set ALLOW_INSECURE_SKIP_AUTH=true to override (DO NOT do this in prod).",
        _ENV_NAME or "<unset>",
    )
elif SKIP_AUTH:
    logger.warning(
        "⚠️ [AUTH] SKIP_AUTH active (ENV=%r). All requests will be treated as DEV_USER_ID.",
        _ENV_NAME or "<unset>",
    )

DEV_USER_ID: str = os.getenv("DEV_USER_ID", "a0778b19-548f-47df-8413-296307566d0f")


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
