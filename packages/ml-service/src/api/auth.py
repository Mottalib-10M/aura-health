"""JWT authentication dependency for the Aura Health ML Service.

Validates Bearer tokens from the Authorization header using python-jose.
Public endpoints (health, ready, metrics) are excluded from authentication.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from jose import JWTError, jwt

from src.config.settings import get_settings

logger = structlog.get_logger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """FastAPI dependency that validates a JWT Bearer token.

    Extracts and decodes the JWT from the Authorization header. Returns the
    decoded token payload on success or raises HTTP 401 on failure.

    Args:
        credentials: Bearer token extracted by FastAPI's HTTPBearer scheme.

    Returns:
        Decoded JWT payload as a dictionary.

    Raises:
        HTTPException: 401 if token is missing, expired, or invalid.
    """
    settings = get_settings()

    if not settings.JWT_SECRET:
        # If no JWT secret is configured, skip authentication (dev mode).
        return {"sub": "anonymous", "dev_mode": True}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload

    except JWTError as exc:
        logger.warning("jwt_validation_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
