import re
from typing import Optional

from pydantic import BaseModel, EmailStr, validator

from app.core.security import validate_email, validate_password


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
            v = re.sub(r'[<>{}]', '', v)
        return v or None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @validator('email')
    def normalize_email(cls, v):
        return validate_email(str(v))


class UpdateNameRequest(BaseModel):
    name: str

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        v = v.strip()
        if len(v) > 100:
            raise ValueError("Name is too long")
        return v


class UpdateRoleRequest(BaseModel):
    role: str

    @validator('role')
    def validate_role(cls, v):
        if v not in ("student", "instructor"):
            raise ValueError("Role must be either 'student' or 'instructor'")
        return v
