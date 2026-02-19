from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.schemas.rubric import RubricCreateRequest, RubricUpdateRequest, RubricResponse
from app.services import rubric_service

router = APIRouter(prefix="/api/rubrics", tags=["rubrics"])


@router.get("", response_model=List[RubricResponse])
def list_rubrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return rubric_service.list_rubrics(current_user, db)


@router.get("/{rubric_id}", response_model=RubricResponse)
def get_rubric(
    rubric_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return rubric_service.get_rubric(rubric_id, current_user, db)


@router.post("", response_model=RubricResponse, status_code=201)
def create_rubric(
    request: RubricCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return rubric_service.create_rubric(request, current_user, db)


@router.put("/{rubric_id}", response_model=RubricResponse)
def update_rubric(
    rubric_id: str,
    request: RubricUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return rubric_service.update_rubric(rubric_id, request, current_user, db)


@router.delete("/{rubric_id}", status_code=204)
def delete_rubric(
    rubric_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rubric_service.delete_rubric(rubric_id, current_user, db)
