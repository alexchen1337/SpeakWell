from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.schemas.classroom import (
    ClassroomCreateRequest, ClassroomResponse, StudentResponse,
    JoinClassRequest, PresentationResponse, ClassGradingResponse, ClassStatsResponse,
)
from app.services import classroom_service

router = APIRouter(prefix="/api/classes", tags=["classes"])


@router.post("", response_model=ClassroomResponse, status_code=201)
def create_class(
    request: ClassroomCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.create_class(request, current_user, db)


@router.get("/teaching", response_model=List[ClassroomResponse])
def list_classes_teaching(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.list_classes_teaching(current_user, db)


@router.get("/enrolled", response_model=List[ClassroomResponse])
def list_classes_enrolled(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.list_classes_enrolled(current_user, db)


@router.post("/join", response_model=ClassroomResponse)
def join_class(
    request: JoinClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.join_class(request, current_user, db)


@router.get("/{class_id}", response_model=ClassroomResponse)
def get_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.get_class(class_id, current_user, db)


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    classroom_service.delete_class(class_id, current_user, db)


@router.get("/{class_id}/students", response_model=List[StudentResponse])
def list_class_students(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.list_students(class_id, current_user, db)


@router.get("/{class_id}/presentations", response_model=List[PresentationResponse])
def list_class_presentations(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.list_presentations(class_id, current_user, db)


@router.get("/{class_id}/gradings", response_model=List[ClassGradingResponse])
def list_class_gradings(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.list_class_gradings(class_id, current_user, db)


@router.get("/{class_id}/stats", response_model=ClassStatsResponse)
def get_class_stats(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return classroom_service.get_class_stats(class_id, current_user, db)


@router.delete("/{class_id}/enrollment", status_code=204)
def leave_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    classroom_service.leave_class(class_id, current_user, db)
