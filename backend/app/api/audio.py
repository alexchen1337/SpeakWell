from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.services import audio_service

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks,
    audio: List[UploadFile] = File(...),
    class_id: Optional[str] = Query(None, description="Optional class ID to associate uploads with"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await audio_service.upload_files(audio, class_id, current_user, db, background_tasks)


@router.get("")
async def get_all_audio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
):
    return audio_service.list_audio(current_user, db, skip, limit, status)


@router.get("/{audio_id}")
async def get_audio(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return audio_service.get_audio(audio_id, current_user, db)


@router.patch("/{audio_id}")
async def update_audio(
    audio_id: str,
    title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return audio_service.update_title(audio_id, title, current_user, db)


@router.patch("/{audio_id}/duration")
async def update_audio_duration(
    audio_id: str,
    duration: int = Query(..., gt=0, description="Duration in seconds"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return audio_service.update_duration(audio_id, duration, current_user, db)


@router.delete("/{audio_id}")
async def delete_audio(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return audio_service.delete_audio(audio_id, current_user, db)


@router.get("/{audio_id}/test-url")
async def test_audio_url(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return audio_service.test_url(audio_id, current_user, db)
