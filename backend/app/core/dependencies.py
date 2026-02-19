from typing import Optional

from fastapi import Cookie, Depends, HTTPException
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session as DBSession
from supabase import create_client, Client

from app.core.config import (
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
    STORAGE_BUCKET, SIGNED_URL_EXPIRES_IN,
    JWT_SECRET, JWT_ALGORITHM,
)
from app.models import SessionLocal, User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    db: DBSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(access_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        db.commit()
        return user

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Supabase clients ---

_supabase_client: Optional[Client] = None
_storage_client: Optional[Client] = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(status_code=500, detail="Supabase configuration missing")
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


def get_supabase_anon_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def ensure_supabase_config():
    if not all([SUPABASE_URL, SUPABASE_ANON_KEY]):
        raise HTTPException(status_code=500, detail="Supabase configuration missing")


def get_storage_client() -> Client:
    global _storage_client
    if _storage_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(status_code=500, detail="Supabase storage not configured")
        _storage_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _storage_client


def generate_signed_url(object_key: str) -> str:
    try:
        client = get_storage_client()
        response = client.storage.from_(STORAGE_BUCKET).create_signed_url(
            object_key, SIGNED_URL_EXPIRES_IN
        )
        if response and "signedURL" in response:
            return response["signedURL"]
        return ""
    except Exception:
        return ""


def download_file(object_key: str) -> bytes:
    client = get_storage_client()
    return client.storage.from_(STORAGE_BUCKET).download(object_key)
