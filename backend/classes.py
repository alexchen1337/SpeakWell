from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid

from database import (
    get_db,
    User,
    Classroom,
    Enrollment,
    AudioFile,
    Transcript,
    Grading,
    generate_join_code,
)
from auth import get_current_user

router = APIRouter(prefix="/api/classes", tags=["classes"])


# ----- Request/Response Models -----

class ClassroomCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class ClassroomResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    joinCode: str = Field(alias="joinCode")
    instructorId: str = Field(alias="instructorId")
    instructorName: Optional[str] = Field(alias="instructorName")
    instructorEmail: str = Field(alias="instructorEmail")
    studentCount: int = Field(alias="studentCount")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class StudentResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    enrolledAt: str = Field(alias="enrolledAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class JoinClassRequest(BaseModel):
    join_code: str = Field(..., min_length=1)


class PresentationResponse(BaseModel):
    id: str
    filename: str
    status: str
    duration: Optional[int]
    fileSize: Optional[int] = Field(alias="fileSize")
    uploadedAt: str = Field(alias="uploadedAt")
    studentId: str = Field(alias="studentId")
    studentName: Optional[str] = Field(alias="studentName")
    studentEmail: str = Field(alias="studentEmail")
    transcriptId: Optional[str] = Field(alias="transcriptId")
    latestGradingId: Optional[str] = Field(alias="latestGradingId")
    latestGradingStatus: Optional[str] = Field(alias="latestGradingStatus")
    latestGradingScore: Optional[float] = Field(alias="latestGradingScore")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")

    class Config:
        from_attributes = True
        populate_by_name = True


class ClassGradingResponse(BaseModel):
    id: str
    transcriptId: str = Field(alias="transcriptId")
    audioFileId: str = Field(alias="audioFileId")
    presentationTitle: str = Field(alias="presentationTitle")
    studentId: str = Field(alias="studentId")
    studentName: Optional[str] = Field(alias="studentName")
    studentEmail: str = Field(alias="studentEmail")
    rubricId: Optional[str] = Field(alias="rubricId")
    rubricName: Optional[str] = Field(alias="rubricName")
    status: str
    overallScore: Optional[float] = Field(alias="overallScore")
    pacingScore: Optional[float] = Field(alias="pacingScore")
    clarityScore: Optional[float] = Field(alias="clarityScore")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByName: Optional[str] = Field(default=None, alias="gradedByName")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


# ----- Helper Functions -----

def build_classroom_response(classroom: Classroom, student_count: int) -> ClassroomResponse:
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


def require_instructor(user: User):
    """Raise 403 if user is not an instructor."""
    if user.role != "instructor":
        raise HTTPException(status_code=403, detail="Only instructors can perform this action")


def require_student(user: User):
    """Raise 403 if user is not a student."""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can perform this action")


# ----- Instructor Endpoints -----

@router.post("", response_model=ClassroomResponse, status_code=201)
def create_class(
    request: ClassroomCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new class (instructors only)."""
    require_instructor(current_user)

    # Generate a unique join code (retry if collision)
    for _ in range(5):
        join_code = generate_join_code()
        existing = db.query(Classroom).filter(Classroom.join_code == join_code).first()
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
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    return build_classroom_response(classroom, 0)


@router.get("/teaching", response_model=List[ClassroomResponse])
def list_classes_teaching(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all classes taught by the current instructor."""
    require_instructor(current_user)

    classrooms = (
        db.query(Classroom)
        .filter(Classroom.instructor_id == current_user.id)
        .order_by(Classroom.created_at.desc())
        .all()
    )

    result = []
    for c in classrooms:
        count = db.query(Enrollment).filter(Enrollment.class_id == c.id).count()
        result.append(build_classroom_response(c, count))
    return result


@router.get("/{class_id}/students", response_model=List[StudentResponse])
def list_class_students(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all enrolled students for a class (instructor only)."""
    classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id)
        .order_by(Enrollment.created_at.desc())
        .all()
    )

    return [
        StudentResponse(
            id=e.student.id,
            email=e.student.email,
            name=e.student.name,
            enrolledAt=e.created_at.isoformat(),
        )
        for e in enrollments
    ]


@router.get("/{class_id}/presentations", response_model=List[PresentationResponse])
def list_class_presentations(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List presentations in a class.
    - Instructors see all presentations.
    - Students see only their own.
    """
    classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    is_instructor = classroom.instructor_id == current_user.id
    is_enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == current_user.id)
        .first()
        is not None
    )

    if not is_instructor and not is_enrolled:
        raise HTTPException(status_code=403, detail="Access denied")

    # Query audio files
    query = db.query(AudioFile).filter(AudioFile.class_id == class_id)
    if not is_instructor:
        # Students only see their own
        query = query.filter(AudioFile.user_id == current_user.id)

    audio_files = query.order_by(AudioFile.created_at.desc()).all()

    result = []
    for af in audio_files:
        transcript = db.query(Transcript).filter(Transcript.audio_file_id == af.id).first()
        latest_grading = None
        if transcript:
            latest_grading = (
                db.query(Grading)
                .filter(Grading.transcript_id == transcript.id)
                .order_by(Grading.created_at.desc())
                .first()
            )

        # Get graded-by user info if there's a grading
        graded_by_user_id = None
        graded_by_role = None
        if latest_grading and latest_grading.graded_by_user_id:
            graded_by_user_id = latest_grading.graded_by_user_id
            if latest_grading.graded_by:
                graded_by_role = latest_grading.graded_by.role

        result.append(
            PresentationResponse(
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
            )
        )

    return result


@router.get("/{class_id}/gradings", response_model=List[ClassGradingResponse])
def list_class_gradings(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all gradings for a class (instructor only).
    Returns a list of grading summaries including student info.
    """
    classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all audio files for this class
    audio_files = db.query(AudioFile).filter(AudioFile.class_id == class_id).all()
    audio_file_ids = [af.id for af in audio_files]

    if not audio_file_ids:
        return []

    # Get transcripts for these audio files
    transcripts = db.query(Transcript).filter(Transcript.audio_file_id.in_(audio_file_ids)).all()
    transcript_ids = [t.id for t in transcripts]
    transcript_map = {t.id: t for t in transcripts}

    if not transcript_ids:
        return []

    # Get all gradings for these transcripts
    gradings = (
        db.query(Grading)
        .filter(Grading.transcript_id.in_(transcript_ids))
        .order_by(Grading.created_at.desc())
        .all()
    )

    # Build audio file map for quick lookup
    audio_file_map = {af.id: af for af in audio_files}

    # Build graded-by lookup
    graded_by_ids = [g.graded_by_user_id for g in gradings if g.graded_by_user_id]
    graded_by_users = {u.id: u for u in db.query(User).filter(User.id.in_(graded_by_ids)).all()} if graded_by_ids else {}

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

        graded_by = graded_by_users.get(g.graded_by_user_id) if g.graded_by_user_id else None

        result.append(
            ClassGradingResponse(
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
                createdAt=g.created_at.isoformat(),
            )
        )

    return result


# ----- Student Endpoints -----

@router.get("/enrolled", response_model=List[ClassroomResponse])
def list_classes_enrolled(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all classes the current student is enrolled in."""
    # Allow both students and instructors to see enrolled classes
    # (in case an instructor was also enrolled as a student somewhere)
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == current_user.id)
        .order_by(Enrollment.created_at.desc())
        .all()
    )

    result = []
    for e in enrollments:
        classroom = e.classroom
        count = db.query(Enrollment).filter(Enrollment.class_id == classroom.id).count()
        result.append(build_classroom_response(classroom, count))
    return result


@router.post("/join", response_model=ClassroomResponse)
def join_class(
    request: JoinClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join a class using a join code (students only)."""
    require_student(current_user)

    # Normalize join code (uppercase, strip whitespace)
    join_code = request.join_code.strip().upper()

    classroom = db.query(Classroom).filter(Classroom.join_code == join_code).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid join code")

    # Check if already enrolled
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == classroom.id, Enrollment.student_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this class")

    enrollment = Enrollment(
        id=str(uuid.uuid4()),
        class_id=classroom.id,
        student_id=current_user.id,
    )
    db.add(enrollment)
    db.commit()

    count = db.query(Enrollment).filter(Enrollment.class_id == classroom.id).count()
    return build_classroom_response(classroom, count)


@router.delete("/{class_id}/enrollment", status_code=204)
def leave_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leave a class (students only)."""
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == current_user.id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")

    db.delete(enrollment)
    db.commit()


# ----- General Endpoints (both roles) -----

@router.get("/{class_id}", response_model=ClassroomResponse)
def get_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get class details (instructor or enrolled students only)."""
    classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    is_instructor = classroom.instructor_id == current_user.id
    is_enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == current_user.id)
        .first()
        is not None
    )

    if not is_instructor and not is_enrolled:
        raise HTTPException(status_code=403, detail="Access denied")

    count = db.query(Enrollment).filter(Enrollment.class_id == class_id).count()
    return build_classroom_response(classroom, count)


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a class (instructor only)."""
    classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    if classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(classroom)
    db.commit()
