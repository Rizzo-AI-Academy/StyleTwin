"""Clerk JWT authentication: verify tokens and upsert users into our DB."""
from datetime import datetime
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        s = get_settings()
        if not s.clerk_jwks_url:
            raise HTTPException(500, "CLERK_JWKS_URL is not configured")
        _jwks_client = PyJWKClient(s.clerk_jwks_url, cache_keys=True)
    return _jwks_client


def verify_clerk_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=s.clerk_issuer or None,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid Clerk token: {e}")


def fetch_clerk_user(clerk_user_id: str) -> dict[str, Any] | None:
    s = get_settings()
    if not s.clerk_secret_key:
        return None
    try:
        r = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {s.clerk_secret_key}"},
            timeout=10,
        )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    return r.json()


def _primary_email(clerk_user: dict[str, Any]) -> str | None:
    emails = clerk_user.get("email_addresses") or []
    primary_id = clerk_user.get("primary_email_address_id")
    for e in emails:
        if e.get("id") == primary_id:
            return e.get("email_address")
    return emails[0].get("email_address") if emails else None


def _upsert_user(db: Session, clerk_id: str, claims: dict[str, Any]) -> User:
    user = db.query(User).filter(User.clerk_id == clerk_id).one_or_none()
    info = fetch_clerk_user(clerk_id) or {}

    email = _primary_email(info) or claims.get("email")
    first_name = info.get("first_name") or claims.get("first_name") or claims.get("given_name")
    last_name = info.get("last_name") or claims.get("last_name") or claims.get("family_name")
    image_url = info.get("image_url") or claims.get("image_url") or claims.get("picture")

    if user is None:
        user = User(
            clerk_id=clerk_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            image_url=image_url,
        )
        db.add(user)
    else:
        # Refresh fields if Clerk has newer info
        if email and user.email != email:
            user.email = email
        if first_name and user.first_name != first_name:
            user.first_name = first_name
        if last_name and user.last_name != last_name:
            user.last_name = last_name
        if image_url and user.image_url != image_url:
            user.image_url = image_url

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: authenticate via Clerk and return the local User row."""
    s = get_settings()

    if s.auth_disabled:
        # DEV ESCAPE HATCH: anonymous user shared by all unauthenticated calls.
        clerk_id = "dev-anonymous"
        user = db.query(User).filter(User.clerk_id == clerk_id).one_or_none()
        if user is None:
            user = User(clerk_id=clerk_id, email="dev@local", first_name="Dev", last_name="User")
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    claims = verify_clerk_token(token)
    clerk_id = claims.get("sub")
    if not clerk_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token: missing sub")

    return _upsert_user(db, clerk_id, claims)
