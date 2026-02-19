import uuid
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    SessionLocal, Grading, GradingStatus, Transcript, AudioFile,
    Rubric, RubricType, Classroom, User,
)
from app.schemas.grading import GradingInitiateRequest, GradingResponse
from app.dao.grading_dao import grading_dao
from app.dao.transcript_dao import transcript_dao
from app.dao.audio_dao import audio_dao
from app.dao.rubric_dao import rubric_dao
from app.dao.classroom_dao import classroom_dao
from app.dao.user_dao import user_dao
from app.services.audio_service import can_access_audio
from app.services.grading_engine import grade_presentation


def build_grading_response(
    grading: Grading,
    rubric_name: Optional[str] = None,
    audio_file_id: Optional[str] = None,
    audio_owner_id: Optional[str] = None,
    presentation_title: Optional[str] = None,
    graded_by_name: Optional[str] = None,
    graded_by_role: Optional[str] = None,
    context_name: Optional[str] = None,
) -> GradingResponse:
    source_type_val = grading.source_type if grading.source_type else "self"
    context_type_val = grading.context_type if grading.context_type else "practice"

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
        sourceType=source_type_val,
        contextType=context_type_val,
        contextId=grading.context_id,
        contextName=context_name,
        isOfficial=bool(grading.is_official) if grading.is_official is not None else False,
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
        createdAt=grading.created_at.isoformat(),
    )


def _is_instructor_for_class(user: User, class_id: str, db: Session) -> bool:
    if not class_id:
        return False
    classroom = classroom_dao.get_by_id(db, class_id)
    return classroom is not None and classroom.instructor_id == user.id


def _get_class_name(class_id: str, db: Session) -> Optional[str]:
    if not class_id:
        return None
    classroom = classroom_dao.get_by_id(db, class_id)
    return classroom.name if classroom else None


def run_grading_task(grading_id: str):
    db = SessionLocal()
    try:
        grade_presentation(grading_id, db)
    except Exception as e:
        print(f"Error in grading task {grading_id}: {e}")
        grading = grading_dao.get_by_id(db, grading_id)
        if grading:
            grading.status = GradingStatus.failed
            db.commit()
    finally:
        db.close()


def initiate_grading(
    request: GradingInitiateRequest,
    background_tasks,
    current_user: User,
    db: Session,
    replace_existing: bool = False,
) -> GradingResponse:
    transcript = transcript_dao.get_by_id(db, request.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = audio_dao.get_by_id(db, transcript.audio_file_id)
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(
            status_code=403,
            detail="Access denied to audio file. You must be the owner or an instructor of the class.",
        )

    rubric = rubric_dao.get_by_id(db, request.rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    if rubric.rubric_type == RubricType.custom:
        if rubric.user_id is None:
            raise HTTPException(status_code=500, detail="Rubric data error: custom rubric missing user_id")
        if rubric.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to rubric. This rubric belongs to another user. (Rubric owner: {rubric.user_id}, Your ID: {current_user.id})",
            )

    source_type = "self"
    context_type = "practice"
    context_id = None
    is_official = False
    context_name = None

    if request.source_type:
        if request.source_type not in ("self", "instructor"):
            raise HTTPException(status_code=400, detail=f"Invalid source_type: {request.source_type}")
        source_type = request.source_type

    if request.context_type:
        if request.context_type not in ("practice", "class"):
            raise HTTPException(status_code=400, detail=f"Invalid context_type: {request.context_type}")
        context_type = request.context_type

    if request.context_id:
        context_id = request.context_id
        if context_type == "class":
            classroom = classroom_dao.get_by_id(db, context_id)
            if not classroom:
                raise HTTPException(status_code=404, detail="Class not found")
            context_name = classroom.name

    if request.is_official:
        if not _is_instructor_for_class(current_user, context_id, db):
            raise HTTPException(status_code=403, detail="Only class instructors can create official gradings")
        is_official = True
        source_type = "instructor"
        context_type = "class"

    if audio_file.class_id and audio_file.user_id != current_user.id:
        if _is_instructor_for_class(current_user, audio_file.class_id, db):
            source_type = "instructor"
            context_type = "class"
            context_id = audio_file.class_id
            context_name = _get_class_name(audio_file.class_id, db)
            is_official = True

    if audio_file.class_id and audio_file.user_id == current_user.id and source_type == "self":
        context_type = "practice"
        context_id = None
        is_official = False

    existing_grading = None
    if replace_existing:
        existing_grading = grading_dao.get_existing(db, request.transcript_id, request.rubric_id)

    if existing_grading:
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
        existing_grading.source_type = source_type
        existing_grading.context_type = context_type
        existing_grading.context_id = context_id
        existing_grading.is_official = 1 if is_official else 0

        db.commit()
        db.refresh(existing_grading)

        background_tasks.add_task(run_grading_task, existing_grading.id)

        return build_grading_response(
            existing_grading, rubric.name,
            audio_file_id=audio_file.id, audio_owner_id=audio_file.user_id,
            presentation_title=audio_file.filename,
            graded_by_name=current_user.name, graded_by_role=current_user.role,
            context_name=context_name,
        )

    grading_id = str(uuid.uuid4())
    grading = Grading(
        id=grading_id,
        transcript_id=request.transcript_id,
        rubric_id=request.rubric_id,
        graded_by_user_id=current_user.id,
        status=GradingStatus.processing,
        source_type=source_type,
        context_type=context_type,
        context_id=context_id,
        is_official=1 if is_official else 0,
    )

    grading_dao.create(db, grading)
    background_tasks.add_task(run_grading_task, grading_id)

    return build_grading_response(
        grading, rubric.name,
        audio_file_id=audio_file.id, audio_owner_id=audio_file.user_id,
        presentation_title=audio_file.filename,
        graded_by_name=current_user.name, graded_by_role=current_user.role,
        context_name=context_name,
    )


def list_transcript_gradings(
    transcript_id: str, current_user: User, db: Session,
) -> List[GradingResponse]:
    transcript = transcript_dao.get_by_id(db, transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = audio_dao.get_by_id(db, transcript.audio_file_id)
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    is_instructor_viewing_student = (
        audio_file.class_id
        and audio_file.user_id != current_user.id
        and _is_instructor_for_class(current_user, audio_file.class_id, db)
    )

    gradings = grading_dao.list_by_transcript(db, transcript_id, official_only=is_instructor_viewing_student)

    rubric_ids = [g.rubric_id for g in gradings if g.rubric_id]
    rubrics = {r.id: r.name for r in rubric_dao.get_by_ids(db, rubric_ids)}

    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in user_dao.get_by_ids(db, graded_by_ids)}

    context_ids = [g.context_id for g in gradings if g.context_id]
    class_names = {}
    if context_ids:
        classes = classroom_dao.get_by_ids(db, context_ids)
        class_names = {c.id: c.name for c in classes}

    result = []
    for g in gradings:
        graded_by = graded_by_users.get(g.graded_by_user_id)
        context_name = class_names.get(g.context_id)
        result.append(build_grading_response(
            g, rubrics.get(g.rubric_id),
            audio_file_id=audio_file.id, audio_owner_id=audio_file.user_id,
            presentation_title=audio_file.filename,
            graded_by_name=graded_by.name if graded_by else None,
            graded_by_role=graded_by.role if graded_by else None,
            context_name=context_name,
        ))
    return result


def list_all_user_gradings(
    current_user: User, db: Session,
    source_type: Optional[str] = None,
    context_type: Optional[str] = None,
    class_id: Optional[str] = None,
    only_official: Optional[bool] = None,
) -> List[GradingResponse]:
    audio_files = audio_dao.list_by_user(db, current_user.id, limit=10000)
    audio_file_ids = [af.id for af in audio_files]

    transcripts = transcript_dao.list_by_audio_ids(db, audio_file_ids)
    transcript_ids = [t.id for t in transcripts]
    transcript_map = {t.id: t for t in transcripts}

    gradings = grading_dao.list_filtered(
        db, transcript_ids,
        source_type=source_type, context_type=context_type,
        class_id=class_id, only_official=only_official,
    )

    rubric_ids = [g.rubric_id for g in gradings if g.rubric_id]
    rubrics = {r.id: r.name for r in rubric_dao.get_by_ids(db, rubric_ids)}

    audio_file_map = {af.id: af for af in audio_files}

    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in user_dao.get_by_ids(db, graded_by_ids)}

    context_ids = [g.context_id for g in gradings if g.context_id]
    class_names = {}
    if context_ids:
        classes = classroom_dao.get_by_ids(db, context_ids)
        class_names = {c.id: c.name for c in classes}

    result = []
    for g in gradings:
        transcript = transcript_map.get(g.transcript_id)
        audio_file = audio_file_map.get(transcript.audio_file_id) if transcript else None
        graded_by = graded_by_users.get(g.graded_by_user_id)
        context_name = class_names.get(g.context_id)

        result.append(build_grading_response(
            g, rubrics.get(g.rubric_id),
            audio_file.id if audio_file else None,
            audio_file.user_id if audio_file else None,
            audio_file.filename if audio_file else None,
            graded_by.name if graded_by else None,
            graded_by.role if graded_by else None,
            context_name=context_name,
        ))
    return result


def get_grading(grading_id: str, current_user: User, db: Session) -> GradingResponse:
    grading = grading_dao.get_by_id(db, grading_id)
    if not grading:
        raise HTTPException(status_code=404, detail="Grading not found")

    transcript = transcript_dao.get_by_id(db, grading.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = audio_dao.get_by_id(db, transcript.audio_file_id)
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if not can_access_audio(audio_file, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    rubric_name = None
    if grading.rubric_id:
        rubric = rubric_dao.get_by_id(db, grading.rubric_id)
        if rubric:
            rubric_name = rubric.name

    graded_by_name = None
    graded_by_role = None
    if grading.graded_by_user_id:
        graded_by = user_dao.get_by_id(db, grading.graded_by_user_id)
        if graded_by:
            graded_by_name = graded_by.name
            graded_by_role = graded_by.role

    context_name = _get_class_name(grading.context_id, db) if grading.context_id else None

    return build_grading_response(
        grading, rubric_name,
        audio_file_id=audio_file.id, audio_owner_id=audio_file.user_id,
        presentation_title=audio_file.filename,
        graded_by_name=graded_by_name, graded_by_role=graded_by_role,
        context_name=context_name,
    )


def delete_grading(grading_id: str, current_user: User, db: Session):
    grading = grading_dao.get_by_id(db, grading_id)
    if not grading:
        raise HTTPException(status_code=404, detail="Grading not found")

    is_grading_creator = grading.graded_by_user_id == current_user.id

    transcript = transcript_dao.get_by_id(db, grading.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    audio_file = audio_dao.get_by_id(db, transcript.audio_file_id)
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    is_audio_owner = audio_file.user_id == current_user.id
    is_instructor_grading = grading.source_type == "instructor" or grading.is_official == 1

    if is_grading_creator:
        grading_dao.delete(db, grading)
        return

    if is_audio_owner:
        if is_instructor_grading:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete grades given by your instructor",
            )
        grading_dao.delete(db, grading)
        return

    raise HTTPException(status_code=403, detail="Access denied")
