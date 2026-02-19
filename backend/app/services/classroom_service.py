import uuid
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import generate_join_code
from app.models import (
    User, Classroom, Enrollment, AudioFile, Transcript, Grading, GradingStatus,
)
from app.schemas.classroom import (
    ClassroomCreateRequest, ClassroomResponse, StudentResponse,
    JoinClassRequest, PresentationResponse, ClassGradingResponse, ClassStatsResponse,
)
from app.dao.classroom_dao import classroom_dao
from app.dao.enrollment_dao import enrollment_dao
from app.dao.audio_dao import audio_dao
from app.dao.transcript_dao import transcript_dao
from app.dao.grading_dao import grading_dao
from app.dao.rubric_dao import rubric_dao
from app.dao.user_dao import user_dao


def _require_instructor(user: User):
    if user.role != "instructor":
        raise HTTPException(status_code=403, detail="Only instructors can perform this action")


def _require_student(user: User):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can perform this action")


def is_instructor_for_class(user: User, class_id: str, db: Session) -> bool:
    if not class_id:
        return False
    classroom = classroom_dao.get_by_id(db, class_id)
    return classroom is not None and classroom.instructor_id == user.id


def is_student_in_class(user: User, class_id: str, db: Session) -> bool:
    if not class_id:
        return False
    enrollment = enrollment_dao.get_by_class_and_student(db, class_id, user.id)
    return enrollment is not None


def get_class_name(class_id: str, db: Session) -> Optional[str]:
    if not class_id:
        return None
    classroom = classroom_dao.get_by_id(db, class_id)
    return classroom.name if classroom else None


def _build_classroom_response(classroom: Classroom, student_count: int) -> ClassroomResponse:
    return ClassroomResponse(
        id=classroom.id,
        name=classroom.name,
        description=classroom.description,
        joinCode=classroom.join_code,
        instructorId=classroom.instructor_id,
        instructorName=classroom.instructor.name if classroom.instructor else None,
        instructorEmail=classroom.instructor.email if classroom.instructor else "",
        studentCount=student_count,
        createdAt=classroom.created_at.isoformat(),
    )


def create_class(request: ClassroomCreateRequest, current_user: User, db: Session) -> ClassroomResponse:
    _require_instructor(current_user)

    for _ in range(5):
        join_code = generate_join_code()
        existing = classroom_dao.get_by_join_code(db, join_code)
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique join code")

    classroom = Classroom(
        id=str(uuid.uuid4()),
        instructor_id=current_user.id,
        name=request.name,
        description=request.description,
        join_code=join_code,
    )
    classroom_dao.create(db, classroom)
    return _build_classroom_response(classroom, 0)


def list_classes_teaching(current_user: User, db: Session) -> List[ClassroomResponse]:
    _require_instructor(current_user)
    classrooms = classroom_dao.list_by_instructor(db, current_user.id)
    result = []
    for c in classrooms:
        count = enrollment_dao.count_by_class(db, c.id)
        result.append(_build_classroom_response(c, count))
    return result


def list_classes_enrolled(current_user: User, db: Session) -> List[ClassroomResponse]:
    enrollments = enrollment_dao.list_by_student(db, current_user.id)
    result = []
    for e in enrollments:
        classroom = e.classroom
        count = enrollment_dao.count_by_class(db, classroom.id)
        result.append(_build_classroom_response(classroom, count))
    return result


def join_class(request: JoinClassRequest, current_user: User, db: Session) -> ClassroomResponse:
    _require_student(current_user)

    join_code = request.join_code.strip().upper()
    classroom = classroom_dao.get_by_join_code(db, join_code)
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid join code")

    existing = enrollment_dao.get_by_class_and_student(db, classroom.id, current_user.id)
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this class")

    enrollment = Enrollment(
        id=str(uuid.uuid4()),
        class_id=classroom.id,
        student_id=current_user.id,
    )
    enrollment_dao.create(db, enrollment)

    count = enrollment_dao.count_by_class(db, classroom.id)
    return _build_classroom_response(classroom, count)


def get_class(class_id: str, current_user: User, db: Session) -> ClassroomResponse:
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    is_instructor = classroom.instructor_id == current_user.id
    is_enrolled = enrollment_dao.get_by_class_and_student(db, class_id, current_user.id) is not None

    if not is_instructor and not is_enrolled:
        raise HTTPException(status_code=403, detail="Access denied")

    count = enrollment_dao.count_by_class(db, class_id)
    return _build_classroom_response(classroom, count)


def delete_class(class_id: str, current_user: User, db: Session):
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")
    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    classroom_dao.delete(db, classroom)


def list_students(class_id: str, current_user: User, db: Session) -> List[StudentResponse]:
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")
    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enrollments = enrollment_dao.list_by_class(db, class_id)
    return [
        StudentResponse(
            id=e.student.id,
            email=e.student.email,
            name=e.student.name,
            enrolledAt=e.created_at.isoformat(),
        )
        for e in enrollments
    ]


def list_presentations(class_id: str, current_user: User, db: Session) -> List[PresentationResponse]:
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    is_instructor = classroom.instructor_id == current_user.id
    is_enrolled = enrollment_dao.get_by_class_and_student(db, class_id, current_user.id) is not None

    if not is_instructor and not is_enrolled:
        raise HTTPException(status_code=403, detail="Access denied")

    if is_instructor:
        audio_files = audio_dao.list_by_class(db, class_id)
    else:
        audio_files = audio_dao.list_by_class_and_user(db, class_id, current_user.id)

    result = []
    for af in audio_files:
        transcript = transcript_dao.get_by_audio_id(db, af.id)
        latest_grading = None
        if transcript:
            if is_instructor:
                latest_grading = grading_dao.get_latest_official_for_transcript(db, transcript.id)
            else:
                official = grading_dao.get_latest_official_any_status(db, transcript.id)
                latest_grading = official if official else grading_dao.get_latest_for_transcript(db, transcript.id)

        graded_by_user_id = None
        graded_by_role = None
        source_type = None
        context_type = None
        is_official_val = None
        if latest_grading:
            if latest_grading.graded_by_user_id:
                graded_by_user_id = latest_grading.graded_by_user_id
                if latest_grading.graded_by:
                    graded_by_role = latest_grading.graded_by.role
            source_type = latest_grading.source_type if latest_grading.source_type else "self"
            context_type = latest_grading.context_type if latest_grading.context_type else "practice"
            is_official_val = bool(latest_grading.is_official) if latest_grading.is_official is not None else False

        result.append(PresentationResponse(
            id=af.id,
            filename=af.filename,
            status=af.status.value,
            duration=af.duration,
            fileSize=af.file_size,
            uploadedAt=af.created_at.isoformat(),
            studentId=af.user_id,
            studentName=af.user.name if af.user else None,
            studentEmail=af.user.email if af.user else "",
            transcriptId=transcript.id if transcript else None,
            latestGradingId=latest_grading.id if latest_grading else None,
            latestGradingStatus=latest_grading.status.value if latest_grading else None,
            latestGradingScore=latest_grading.overall_score if latest_grading else None,
            gradedByUserId=graded_by_user_id,
            gradedByRole=graded_by_role,
            sourceType=source_type,
            contextType=context_type,
            isOfficial=is_official_val,
        ))
    return result


def list_class_gradings(class_id: str, current_user: User, db: Session) -> List[ClassGradingResponse]:
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")
    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    audio_files = audio_dao.list_by_class(db, class_id)
    audio_file_ids = [af.id for af in audio_files]
    if not audio_file_ids:
        return []

    transcripts = transcript_dao.list_by_audio_ids(db, audio_file_ids)
    transcript_ids = [t.id for t in transcripts]
    transcript_map = {t.id: t for t in transcripts}
    if not transcript_ids:
        return []

    gradings = grading_dao.list_by_transcript_ids_official(db, transcript_ids)

    audio_file_map = {af.id: af for af in audio_files}

    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in user_dao.get_by_ids(db, graded_by_ids)}

    result = []
    for g in gradings:
        transcript = transcript_map.get(g.transcript_id)
        if not transcript:
            continue
        audio_file = audio_file_map.get(transcript.audio_file_id)
        if not audio_file:
            continue

        rubric_name = None
        if g.rubric_id and g.rubric:
            rubric_name = g.rubric.name

        graded_by = graded_by_users.get(g.graded_by_user_id)

        result.append(ClassGradingResponse(
            id=g.id,
            transcriptId=g.transcript_id,
            audioFileId=audio_file.id,
            presentationTitle=audio_file.filename,
            studentId=audio_file.user_id,
            studentName=audio_file.user.name if audio_file.user else None,
            studentEmail=audio_file.user.email if audio_file.user else "",
            rubricId=g.rubric_id,
            rubricName=rubric_name,
            status=g.status.value,
            overallScore=g.overall_score,
            pacingScore=g.pacing_score,
            clarityScore=g.clarity_score,
            gradedByUserId=g.graded_by_user_id,
            gradedByName=graded_by.name if graded_by else None,
            gradedByRole=graded_by.role if graded_by else None,
            sourceType=g.source_type if g.source_type else "self",
            contextType=g.context_type if g.context_type else "practice",
            isOfficial=bool(g.is_official) if g.is_official is not None else False,
            createdAt=g.created_at.isoformat(),
        ))
    return result


def get_class_stats(class_id: str, current_user: User, db: Session) -> ClassStatsResponse:
    classroom = classroom_dao.get_by_id(db, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")
    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    audio_files = audio_dao.list_by_class(db, class_id)
    total_presentations = len(audio_files)

    empty_stats = ClassStatsResponse(
        totalPresentations=total_presentations,
        gradedPresentations=0,
        officialGradings=0,
        averageScore=None,
        scoreDistribution={"80-100": 0, "60-79": 0, "40-59": 0, "0-39": 0},
    )

    if total_presentations == 0:
        return empty_stats

    audio_file_ids = [af.id for af in audio_files]
    transcripts = transcript_dao.list_by_audio_ids(db, audio_file_ids)
    transcript_ids = [t.id for t in transcripts]

    if not transcript_ids:
        return empty_stats

    completed_gradings = grading_dao.list_completed_official(db, transcript_ids)

    graded_presentations = len(set(g.transcript_id for g in completed_gradings))
    official_gradings = len(completed_gradings)

    scores = [g.overall_score for g in completed_gradings if g.overall_score is not None]
    average_score = sum(scores) / len(scores) if scores else None

    distribution = {"80-100": 0, "60-79": 0, "40-59": 0, "0-39": 0}
    for score in scores:
        if score >= 80:
            distribution["80-100"] += 1
        elif score >= 60:
            distribution["60-79"] += 1
        elif score >= 40:
            distribution["40-59"] += 1
        else:
            distribution["0-39"] += 1

    return ClassStatsResponse(
        totalPresentations=total_presentations,
        gradedPresentations=graded_presentations,
        officialGradings=official_gradings,
        averageScore=average_score,
        scoreDistribution=distribution,
    )


def leave_class(class_id: str, current_user: User, db: Session):
    enrollment = enrollment_dao.get_by_class_and_student(db, class_id, current_user.id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    enrollment_dao.delete(db, enrollment)
