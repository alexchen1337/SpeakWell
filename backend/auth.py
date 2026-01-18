from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import hashlib
import os
import re
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Response, Cookie, Depends
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, validator
from supabase import create_client, Client

from database import get_db, User, Session as DBSession

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

router = APIRouter(prefix="/auth", tags=["authentication"])

FRONTEND_URL = os.getenv("FRONTEND_URL")
BACKEND_URL = os.getenv("BACKEND_URL")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

IS_DEVELOPMENT = FRONTEND_URL and ("localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL)

_supabase_client: Optional[Client] = None


def validate_email(email: str) -> str:
    """Validate and normalize email address"""
    if not email:
        raise ValueError("Email is required")
    
    email = email.strip().lower()
    
    # Basic email regex pattern
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValueError("Invalid email format")
    
    # Additional checks
    if len(email) > 254:  # RFC 5321
        raise ValueError("Email is too long")
    
    local_part, domain = email.rsplit('@', 1)
    if len(local_part) > 64:  # RFC 5321
        raise ValueError("Email local part is too long")
    
    return email


def validate_password(password: str) -> None:
    """Validate password strength"""
    if not password:
        raise ValueError("Password is required")
    
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")
    
    if len(password) > 128:
        raise ValueError("Password is too long")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    
    @validator('email')
    def normalize_email(cls, v):
        return validate_email(str(v))
    
    @validator('password')
    def check_password(cls, v):
        validate_password(v)
        return v


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    
    @validator('email')
    def normalize_email(cls, v):
        return validate_email(str(v))
    
    @validator('password')
    def check_password(cls, v):
        validate_password(v)
        return v
    
    @validator('name')
    def sanitize_name(cls, v):
        if v:
            v = v.strip()
            if len(v) > 100:
                raise ValueError("Name is too long")
            # Remove any potentially dangerous characters
            v = re.sub(r'[<>{}]', '', v)
        return v or None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    
    @validator('email')
    def normalize_email(cls, v):
        return validate_email(str(v))


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


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_current_user(
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db)
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


def create_user_session(user: User, response: Response, db: Session):
    """Create JWT access token and refresh token, set cookies"""
    jwt_access_token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )
    app_refresh_token = create_refresh_token()
    
    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=hash_refresh_token(app_refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        created_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    
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


@router.post("/signup")
async def signup(
    request: SignupRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Sign up with email and password using Supabase Auth"""
    ensure_supabase_config()
    
    # Email and password are already validated by Pydantic
    # Check if email already exists in our database
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        supabase = get_supabase_anon_client()
        
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "name": request.name
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create account")
        
        supabase_user = auth_response.user
        
        # check if user exists in our DB (double check)
        user = db.query(User).filter(User.identity_provider_id == supabase_user.id).first()
        
        if not user and supabase_user.email:
            user = db.query(User).filter(User.email == supabase_user.email.lower()).first()
        
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                identity_provider_id=supabase_user.id,
                email=supabase_user.email.lower() if supabase_user.email else None,
                name=request.name or supabase_user.email.split("@")[0] if supabase_user.email else None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # if email confirmation required, return message
        if not supabase_user.email_confirmed_at:
            return {"message": "Check your email to confirm your account", "requires_confirmation": True}
        
        create_user_session(user, response, db)
        
        return {
            "message": "Account created successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
            }
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


@router.post("/login")
async def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Login with email and password using Supabase Auth"""
    ensure_supabase_config()
    
    try:
        supabase = get_supabase_anon_client()
        
        # Email is already validated and normalized by Pydantic
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        supabase_user = auth_response.user
        
        # find or create user in our DB
        user = db.query(User).filter(User.identity_provider_id == supabase_user.id).first()
        
        if not user and supabase_user.email:
            user = db.query(User).filter(User.email == supabase_user.email.lower()).first()
        
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                identity_provider_id=supabase_user.id,
                email=supabase_user.email.lower() if supabase_user.email else None,
                name=supabase_user.user_metadata.get("name") or supabase_user.email.split("@")[0] if supabase_user.email else None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(user)
        else:
            user.identity_provider_id = supabase_user.id
            user.email = supabase_user.email.lower() if supabase_user.email else user.email
            user.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(user)
        
        create_user_session(user, response, db)
        
        return {
            "message": "Login successful",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
            }
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


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "organization": current_user.organization,
        "group": current_user.group,
    }


@router.post("/refresh")
async def refresh_access_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db)
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    token_hash = hash_refresh_token(refresh_token)
    session = db.query(DBSession).filter(
        DBSession.refresh_token == token_hash,
        DBSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access_token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )
    
    # rotate refresh token
    new_refresh_token = create_refresh_token()
    session.refresh_token = hash_refresh_token(new_refresh_token)
    session.expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    
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




@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db)
):
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        db.query(DBSession).filter(DBSession.refresh_token == token_hash).delete()
        db.commit()
    
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
