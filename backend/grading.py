from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid

from database import get_db, SessionLocal, User, Transcript, Rubric, Grading, GradingStatus, AudioFile, Classroom
from auth import get_current_user
from grading_engine import grade_presentation


def can_access_audio(audio: AudioFile, user: User, db: Session) -> bool:
    """
    Check if user can access an audio file.
    - Owner can always access
    - Instructor can access if audio is linked to their class
    """
    if audio.user_id == user.id:
        return True
    
    # Check if user is an instructor for the audio's class
    if audio.class_id:
        classroom = db.query(Classroom).filter(Classroom.id == audio.class_id).first()
        if classroom and classroom.instructor_id == user.id:
            return True
    
    return False

router = APIRouter(prefix="/api", tags=["grading"])


class GradingInitiateRequest(BaseModel):
    transcript_id: str
    rubric_id: str


class GradingResponse(BaseModel):
    id: str
    transcriptId: str = Field(alias="transcriptId")
    audioFileId: Optional[str] = Field(alias="audioFileId")
    audioOwnerId: Optional[str] = Field(default=None, alias="audioOwnerId")
    presentationTitle: Optional[str] = Field(alias="presentationTitle")
    rubricId: Optional[str] = Field(alias="rubricId")
    rubricName: Optional[str] = Field(alias="rubricName")
    status: str
    overallScore: Optional[float] = Field(alias="overallScore")
    maxPossibleScore: Optional[float] = Field(alias="maxPossibleScore")
    pacingWpmAvg: Optional[float] = Field(alias="pacingWpmAvg")
    pacingWpmVariance: Optional[float] = Field(alias="pacingWpmVariance")
    pacingPauseCount: Optional[int] = Field(alias="pacingPauseCount")
    pacingScore: Optional[float] = Field(alias="pacingScore")
    clarityFillerWordCount: Optional[int] = Field(alias="clarityFillerWordCount")
    clarityFillerWordPercentage: Optional[float] = Field(alias="clarityFillerWordPercentage")
    clarityNonsensicalWordCount: Optional[int] = Field(alias="clarityNonsensicalWordCount")
    clarityScore: Optional[float] = Field(alias="clarityScore")
    detailedResults: Optional[dict] = Field(alias="detailedResults")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByName: Optional[str] = Field(default=None, alias="gradedByName")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


def build_grading_response(
    grading: Grading, 
    rubric_name: Optional[str] = None,
    audio_file_id: Optional[str] = None,
    audio_owner_id: Optional[str] = None,
    presentation_title: Optional[str] = None,
    graded_by_name: Optional[str] = None,
    graded_by_role: Optional[str] = None
) -> GradingResponse:
    """Build a GradingResponse from a Grading object."""
    return GradingResponse(
        id=grading.id,
        transcriptId=grading.transcript_id,
        audioFileId=audio_file_id,
        audioOwnerId=audio_owner_id,
        presentationTitle=presentation_title,
        rubricId=grading.rubric_id,
        rubricName=rubric_name,
        status=grading.status.value,
        overallScore=grading.overall_score,
        maxPossibleScore=grading.max_possible_score,
        pacingWpmAvg=grading.pacing_wpm_avg,
        pacingWpmVariance=grading.pacing_wpm_variance,
        pacingPauseCount=grading.pacing_pause_count,
        pacingScore=grading.pacing_score,
        clarityFillerWordCount=grading.clarity_filler_word_count,
        clarityFillerWordPercentage=grading.clarity_filler_word_percentage,
        clarityNonsensicalWordCount=grading.clarity_nonsensical_word_count,
        clarityScore=grading.clarity_score,
        detailedResults=grading.detailed_results,
        gradedByUserId=grading.graded_by_user_id,
        gradedByName=graded_by_name,
        gradedByRole=graded_by_role,
        createdAt=grading.created_at.isoformat()
    )


def run_grading_task(grading_id: str):
    """Background task wrapper for grading."""
    db = SessionLocal()
    try:
        grade_presentation(grading_id, db)
    except Exception as e:
        print(f"Error in grading task {grading_id}: {e}")
        # Update status to failed if error occurs
        grading = db.query(Grading).filter(Grading.id == grading_id).first()
        if grading:
            grading.status = GradingStatus.failed
            db.commit()
    finally:
        db.close()


@router.post("/gradings", response_model=GradingResponse, status_code=201)
def initiate_grading(
    request: GradingInitiateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    replace_existing: bool = False
):
    """Initiate grading for a transcript."""
    # Verify transcript exists
    transcript = db.query(Transcript).filter(Transcript.id == request.transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    # Check access via AudioFile (owner or instructor of class)
    audio_file = db.query(AudioFile).filter(AudioFile.id == transcript.audio_file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify rubric exists and user has access
    rubric = db.query(Rubric).filter(Rubric.id == request.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # Check rubric access (built-in or user's custom)
    if rubric.rubric_type.value == "custom" and rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to rubric")

    # If replace_existing, find and reuse existing grading for this transcript+rubric
    existing_grading = None
    if replace_existing:
        existing_grading = db.query(Grading).filter(
            Grading.transcript_id == request.transcript_id,
            Grading.rubric_id == request.rubric_id
        ).first()

    if existing_grading:
        # Reset existing grading to processing state
        existing_grading.status = GradingStatus.processing
        existing_grading.overall_score = None
        existing_grading.max_possible_score = None
        existing_grading.pacing_wpm_avg = None
        existing_grading.pacing_wpm_variance = None
        existing_grading.pacing_pause_count = None
        existing_grading.pacing_score = None
        existing_grading.clarity_filler_word_count = None
        existing_grading.clarity_filler_word_percentage = None
        existing_grading.clarity_nonsensical_word_count = None
        existing_grading.clarity_score = None
        existing_grading.detailed_results = None
        existing_grading.graded_by_user_id = current_user.id
        
        db.commit()
        db.refresh(existing_grading)
        
        # Trigger background task
        background_tasks.add_task(run_grading_task, existing_grading.id)
        
        return build_grading_response(
            existing_grading, 
            rubric.name,
            audio_file_id=audio_file.id,
            audio_owner_id=audio_file.user_id,
            presentation_title=audio_file.filename,
            graded_by_name=current_user.name,
            graded_by_role=current_user.role
        )
    else:
        # Create new grading record
        grading_id = str(uuid.uuid4())
        grading = Grading(
            id=grading_id,
            transcript_id=request.transcript_id,
            rubric_id=request.rubric_id,
            graded_by_user_id=current_user.id,
            status=GradingStatus.processing
        )

        db.add(grading)
        db.commit()
        db.refresh(grading)

        # Trigger background task
        background_tasks.add_task(run_grading_task, grading_id)

        return build_grading_response(
            grading, 
            rubric.name,
            audio_file_id=audio_file.id,
            audio_owner_id=audio_file.user_id,
            presentation_title=audio_file.filename,
            graded_by_name=current_user.name,
            graded_by_role=current_user.role
        )


@router.get("/transcripts/{transcript_id}/gradings", response_model=List[GradingResponse])
def list_transcript_gradings(
    transcript_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all gradings for a transcript."""
    # Verify transcript exists
    transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    # Check access via AudioFile
    audio_file = db.query(AudioFile).filter(AudioFile.id == transcript.audio_file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    gradings = db.query(Grading).filter(Grading.transcript_id == transcript_id).all()

    # Build rubric name lookup
    rubric_ids = [g.rubric_id for g in gradings if g.rubric_id]
    rubrics = {r.id: r.name for r in db.query(Rubric).filter(Rubric.id.in_(rubric_ids)).all()}

    # Build graded-by lookup
    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in db.query(User).filter(User.id.in_(graded_by_ids)).all()}

    result = []
    for g in gradings:
        graded_by = graded_by_users.get(g.graded_by_user_id) if g.graded_by_user_id else None
        result.append(build_grading_response(
            g, 
            rubrics.get(g.rubric_id) if g.rubric_id else None,
            audio_file_id=audio_file.id,
            audio_owner_id=audio_file.user_id,
            presentation_title=audio_file.filename,
            graded_by_name=graded_by.name if graded_by else None,
            graded_by_role=graded_by.role if graded_by else None
        ))
    return result


@router.get("/gradings/all", response_model=List[GradingResponse])
def list_all_user_gradings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all gradings for the current user across all presentations."""
    # Get all user's audio files
    audio_files = db.query(AudioFile).filter(AudioFile.user_id == current_user.id).all()
    audio_file_ids = [af.id for af in audio_files]
    
    # Get all transcripts for user's audio files
    transcripts = db.query(Transcript).filter(Transcript.audio_file_id.in_(audio_file_ids)).all()
    transcript_ids = [t.id for t in transcripts]
    transcript_map = {t.id: t for t in transcripts}
    
    # Get all gradings for these transcripts
    gradings = db.query(Grading).filter(Grading.transcript_id.in_(transcript_ids)).order_by(Grading.created_at.desc()).all()
    
    # Build rubric name lookup
    rubric_ids = [g.rubric_id for g in gradings if g.rubric_id]
    rubrics = {r.id: r.name for r in db.query(Rubric).filter(Rubric.id.in_(rubric_ids)).all()}
    
    # Build audio file lookup
    audio_file_map = {af.id: af for af in audio_files}
    
    # Build graded-by lookup
    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in db.query(User).filter(User.id.in_(graded_by_ids)).all()}
    
    result = []
    for g in gradings:
        transcript = transcript_map.get(g.transcript_id)
        audio_file = audio_file_map.get(transcript.audio_file_id) if transcript else None
        graded_by = graded_by_users.get(g.graded_by_user_id) if g.graded_by_user_id else None
        
        result.append(build_grading_response(
            g,
            rubrics.get(g.rubric_id) if g.rubric_id else None,
            audio_file.id if audio_file else None,
            audio_file.user_id if audio_file else None,
            audio_file.filename if audio_file else None,
            graded_by.name if graded_by else None,
            graded_by.role if graded_by else None
        ))
    
    return result


@router.get("/gradings/{grading_id}", response_model=GradingResponse)
def get_grading(
    grading_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific grading with full details."""
    grading = db.query(Grading).filter(Grading.id == grading_id).first()
    if not grading:
        raise HTTPException(status_code=404, detail="Grading not found")

    # Verify access via transcript -> audio file
    transcript = db.query(Transcript).filter(Transcript.id == grading.transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = db.query(AudioFile).filter(AudioFile.id == transcript.audio_file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get rubric name
    rubric_name = None
    if grading.rubric_id:
        rubric = db.query(Rubric).filter(Rubric.id == grading.rubric_id).first()
        if rubric:
            rubric_name = rubric.name

    # Get graded-by user info
    graded_by_name = None
    graded_by_role = None
    if grading.graded_by_user_id:
        graded_by = db.query(User).filter(User.id == grading.graded_by_user_id).first()
        if graded_by:
            graded_by_name = graded_by.name
            graded_by_role = graded_by.role

    return build_grading_response(
        grading, 
        rubric_name,
        audio_file_id=audio_file.id,
        audio_owner_id=audio_file.user_id,
        presentation_title=audio_file.filename,
        graded_by_name=graded_by_name,
        graded_by_role=graded_by_role
    )


@router.delete("/gradings/{grading_id}", status_code=204)
def delete_grading(
    grading_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a grading. Allowed for:
    - The audio owner (can delete any grading on their presentation)
    - The grading creator (can delete gradings they initiated)
    """
    grading = db.query(Grading).filter(Grading.id == grading_id).first()
    if not grading:
        raise HTTPException(status_code=404, detail="Grading not found")

    # Check if user is the grading creator
    is_grading_creator = grading.graded_by_user_id == current_user.id

    # Check if user is the audio owner
    transcript = db.query(Transcript).filter(Transcript.id == grading.transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = db.query(AudioFile).filter(AudioFile.id == transcript.audio_file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    is_audio_owner = audio_file.user_id == current_user.id

    # Allow deletion if user is either the audio owner or grading creator
    if not is_audio_owner and not is_grading_creator:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(grading)
    db.commit()
