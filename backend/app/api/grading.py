from typing import List, Optional

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.schemas.grading import GradingInitiateRequest, GradingResponse
from app.services import grading_service

router = APIRouter(prefix="/api", tags=["grading"])


@router.post("/gradings", response_model=GradingResponse, status_code=201)
def initiate_grading(
    request: GradingInitiateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    replace_existing: bool = False,
):
    return grading_service.initiate_grading(request, background_tasks, current_user, db, replace_existing)


@router.get("/transcripts/{transcript_id}/gradings", response_model=List[GradingResponse])
def list_transcript_gradings(
    transcript_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return grading_service.list_transcript_gradings(transcript_id, current_user, db)


@router.get("/gradings/all", response_model=List[GradingResponse])
def list_all_user_gradings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    source_type: Optional[str] = None,
    context_type: Optional[str] = None,
    class_id: Optional[str] = None,
    only_official: Optional[bool] = None,
):
    return grading_service.list_all_user_gradings(
        current_user, db, source_type, context_type, class_id, only_official,
    )


@router.get("/gradings/{grading_id}", response_model=GradingResponse)
def get_grading(
    grading_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return grading_service.get_grading(grading_id, current_user, db)


@router.delete("/gradings/{grading_id}", status_code=204)
def delete_grading(
    grading_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grading_service.delete_grading(grading_id, current_user, db)
