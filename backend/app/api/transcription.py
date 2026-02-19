from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.services import transcription_service

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])


@router.get("/{audio_id}")
async def get_transcript(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return transcription_service.get_transcript(audio_id, current_user, db)


@router.post("/{audio_id}/retry")
async def retry_transcription(
    audio_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return transcription_service.retry_transcription(audio_id, current_user, db, background_tasks)
