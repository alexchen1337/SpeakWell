import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, IS_DEVELOPMENT,
)
from app.core.security import (
    create_access_token, create_refresh_token, hash_refresh_token,
)
from app.core.dependencies import (
    get_supabase_anon_client, ensure_supabase_config,
)
from app.models import User, Session as DBSession
from app.dao.user_dao import user_dao
from app.dao.session_dao import session_dao


def _create_user_session(user: User, response: Response, db: Session) -> str:
    jwt_access_token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )
    app_refresh_token = create_refresh_token()

    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=hash_refresh_token(app_refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        created_at=datetime.utcnow(),
    )
    session_dao.create(db, session)

    response.set_cookie(
        key="access_token",
        value=jwt_access_token,
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=app_refresh_token,
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )
    return jwt_access_token


def signup(request, response: Response, db: Session) -> dict:
    ensure_supabase_config()

    existing_user = user_dao.get_by_email(db, request.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        supabase = get_supabase_anon_client()
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {"data": {"name": request.name}},
        })

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create account")

        supabase_user = auth_response.user

        user = user_dao.get_by_identity_provider_id(db, supabase_user.id)
        if not user and supabase_user.email:
            user = user_dao.get_by_email(db, supabase_user.email.lower())

        if not user:
            user = User(
                id=str(uuid.uuid4()),
                identity_provider_id=supabase_user.id,
                email=supabase_user.email.lower() if supabase_user.email else None,
                name=request.name or supabase_user.email.split("@")[0] if supabase_user.email else None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            user_dao.create(db, user)

        if not supabase_user.email_confirmed_at:
            return {"message": "Check your email to confirm your account", "requires_confirmation": True}

        _create_user_session(user, response, db)

        return {
            "message": "Account created successfully",
            "user": {"id": user.id, "email": user.email, "name": user.name},
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower() or "already exists" in error_msg.lower() or "user already registered" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail=f"Signup failed: {error_msg}")


def login(request, response: Response, db: Session) -> dict:
    ensure_supabase_config()

    try:
        supabase = get_supabase_anon_client()
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        supabase_user = auth_response.user

        user = user_dao.get_by_identity_provider_id(db, supabase_user.id)
        if not user and supabase_user.email:
            user = user_dao.get_by_email(db, supabase_user.email.lower())

        if not user:
            user = User(
                id=str(uuid.uuid4()),
                identity_provider_id=supabase_user.id,
                email=supabase_user.email.lower() if supabase_user.email else None,
                name=supabase_user.user_metadata.get("name") or supabase_user.email.split("@")[0] if supabase_user.email else None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)
        else:
            user.identity_provider_id = supabase_user.id
            user.email = supabase_user.email.lower() if supabase_user.email else user.email
            user.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        _create_user_session(user, response, db)

        return {
            "message": "Login successful",
            "user": {"id": user.id, "email": user.email, "name": user.name},
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        if "invalid" in error_msg.lower() or "credentials" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=401, detail="Login failed")


def refresh(response: Response, refresh_token: str | None, db: Session) -> dict:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    token_hash = hash_refresh_token(refresh_token)
    session = session_dao.get_by_refresh_token_hash(db, token_hash)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = user_dao.get_by_id(db, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )

    new_refresh_token = create_refresh_token()
    session.refresh_token = hash_refresh_token(new_refresh_token)
    session.expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    session_dao.update(db, session)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )

    return {"message": "Token refreshed successfully"}


def logout(response: Response, refresh_token: str | None, db: Session) -> dict:
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        session_dao.delete_by_refresh_token_hash(db, token_hash)

    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        path="/",
    )
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=not IS_DEVELOPMENT,
        samesite="lax",
        path="/",
    )

    return {"message": "Logged out successfully"}


def get_user_info(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "organization": user.organization,
        "group": user.group,
    }


def update_name(user: User, name: str, db: Session) -> dict:
    user_dao.update_name(db, user, name)
    return {"message": "Name updated successfully", "name": user.name}


def update_role(user: User, role: str, db: Session) -> dict:
    user_dao.update_role(db, user, role)
    return {"message": "Role updated successfully", "role": user.role}
