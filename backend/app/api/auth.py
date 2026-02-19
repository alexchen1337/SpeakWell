from typing import Optional

from fastapi import APIRouter, Response, Cookie, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.schemas.auth import (
    LoginRequest, SignupRequest, UpdateNameRequest, UpdateRoleRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/signup")
async def signup(
    request: SignupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    return auth_service.signup(request, response, db)


@router.post("/login")
async def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    return auth_service.login(request, response, db)


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return auth_service.get_user_info(current_user)


@router.patch("/me/name")
async def update_user_name(
    request: UpdateNameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return auth_service.update_name(current_user, request.name, db)


@router.patch("/me/role")
async def update_user_role(
    request: UpdateRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return auth_service.update_role(current_user, request.role, db)


@router.post("/refresh")
async def refresh_access_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
):
    return auth_service.refresh(response, refresh_token, db)


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
):
    return auth_service.logout(response, refresh_token, db)
