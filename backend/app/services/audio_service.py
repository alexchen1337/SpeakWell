import io
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import STORAGE_BUCKET
from app.core.dependencies import get_storage_client, generate_signed_url
from app.models import AudioFile, AudioStatus, User, Classroom, Enrollment
from app.dao.audio_dao import audio_dao
from app.dao.classroom_dao import classroom_dao
from app.dao.enrollment_dao import enrollment_dao
from app.schemas.audio import build_audio_response

try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False


def can_access_audio(audio: AudioFile, user: User, db: Session) -> bool:
    if audio.user_id == user.id:
        return True
    if audio.class_id:
        classroom = classroom_dao.get_by_id(db, audio.class_id)
        if classroom and classroom.instructor_id == user.id:
            return True
    return False


def extract_audio_duration(file_contents: bytes, filename: str) -> Optional[int]:
    if not MUTAGEN_AVAILABLE:
        return None
    try:
        audio_file = MutagenFile(io.BytesIO(file_contents))
        if audio_file and hasattr(audio_file, 'info') and hasattr(audio_file.info, "length"):
            duration = int(audio_file.info.length)
            if duration > 0:
                return duration
    except Exception:
        pass
    try:
        audio_file = MutagenFile(io.BytesIO(file_contents), easy=True)
        if audio_file and hasattr(audio_file, 'info') and hasattr(audio_file.info, "length"):
            duration = int(audio_file.info.length)
            if duration > 0:
                return duration
    except Exception:
        pass
    return None


def get_unique_filename(db: Session, user_id: str, filename: str) -> str:
    if not audio_dao.check_filename_exists(db, user_id, filename):
        return filename

    base_name = filename
    extension = ""
    if "." in filename:
        last_dot = filename.rfind(".")
        base_name = filename[:last_dot]
        extension = filename[last_dot:]

    counter = 1
    while True:
        new_filename = f"{base_name} ({counter}){extension}"
        if not audio_dao.check_filename_exists(db, user_id, new_filename):
            return new_filename
        counter += 1
        if counter > 100:
            return f"{base_name} ({uuid.uuid4().hex[:8]}){extension}"


async def upload_files(
    files: list[UploadFile],
    class_id: Optional[str],
    current_user: User,
    db: Session,
    background_tasks,
) -> list[dict]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per upload")

    validated_class_id = None
    if class_id:
        classroom = classroom_dao.get_by_id(db, class_id)
        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found")

        if current_user.role == "student":
            enrollment = enrollment_dao.get_by_class_and_student(db, class_id, current_user.id)
            if not enrollment:
                raise HTTPException(status_code=403, detail="You are not enrolled in this class")
        elif current_user.role == "instructor":
            if classroom.instructor_id != current_user.id:
                raise HTTPException(status_code=403, detail="You do not teach this class")
        else:
            raise HTTPException(status_code=403, detail="Please set your role before uploading to a class")
        validated_class_id = class_id

    uploaded_files = []
    failed_files = []

    try:
        storage_client = get_storage_client()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to storage: {str(e)}")

    for file in files:
        object_key = None
        try:
            if not file.content_type or not file.content_type.startswith("audio/"):
                failed_files.append({"filename": file.filename, "error": "Not an audio file"})
                continue
            if file.size and file.size > 100 * 1024 * 1024:
                failed_files.append({"filename": file.filename, "error": "File too large (max 100MB)"})
                continue

            file_id = str(uuid.uuid4())
            file_extension = os.path.splitext(file.filename)[1]
            object_key = f"{current_user.id}/{file_id}{file_extension}"

            contents = await file.read()
            if not contents:
                failed_files.append({"filename": file.filename, "error": "Empty file"})
                continue

            storage_client.storage.from_(STORAGE_BUCKET).upload(
                path=object_key,
                file=contents,
                file_options={
                    "content-type": file.content_type,
                    "cache-control": "public, max-age=31536000",
                },
            )

            file_size = len(contents)
            duration = extract_audio_duration(contents, file.filename)
            unique_filename = get_unique_filename(db, current_user.id, file.filename)

            audio_file = AudioFile(
                id=file_id,
                user_id=current_user.id,
                object_key=object_key,
                filename=unique_filename,
                file_size=file_size,
                duration=duration,
                class_id=validated_class_id,
                status=AudioStatus.uploaded,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            audio_dao.create(db, audio_file)

            from app.services.transcription_service import transcribe_audio_file
            background_tasks.add_task(
                transcribe_audio_file,
                audio_file.id,
                audio_file.object_key,
                audio_file.filename,
            )

            secure_url = generate_signed_url(object_key)
            uploaded_files.append(build_audio_response(
                audio_file.id, unique_filename, secure_url,
                audio_file.file_size, audio_file.duration,
                audio_file.status.value, audio_file.created_at.isoformat(),
            ))
        except Exception as e:
            db.rollback()
            failed_files.append({"filename": file.filename, "error": str(e)})
            if object_key:
                try:
                    storage_client.storage.from_(STORAGE_BUCKET).remove([object_key])
                except Exception:
                    pass

    if not uploaded_files and failed_files:
        error_details = "; ".join([f"{f['filename']}: {f['error']}" for f in failed_files])
        raise HTTPException(status_code=400, detail=f"All uploads failed - {error_details}")

    return uploaded_files


def list_audio(current_user: User, db: Session, skip: int, limit: int, status: Optional[str]) -> list[dict]:
    status_enum = None
    if status:
        try:
            status_enum = AudioStatus[status]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    audio_files = audio_dao.list_by_user(db, current_user.id, status=status_enum, skip=skip, limit=limit)
    return [
        build_audio_response(
            a.id, a.filename, generate_signed_url(a.object_key),
            a.file_size, a.duration, a.status.value, a.created_at.isoformat(),
        )
        for a in audio_files
    ]


def get_audio(audio_id: str, current_user: User, db: Session) -> dict:
    audio = audio_dao.get_by_id(db, audio_id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if not can_access_audio(audio, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return build_audio_response(
        audio.id, audio.filename, generate_signed_url(audio.object_key),
        audio.file_size, audio.duration, audio.status.value,
        audio.created_at.isoformat(), audio.updated_at.isoformat(),
    )


def update_title(audio_id: str, title: str, current_user: User, db: Session) -> dict:
    audio = audio_dao.get_by_id_and_user(db, audio_id, current_user.id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if not title or not title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    clean_title = title.strip()
    if audio_dao.check_filename_exists(db, current_user.id, clean_title, exclude_id=audio_id):
        raise HTTPException(status_code=409, detail="A presentation with this name already exists")

    audio_dao.update_filename(db, audio, clean_title)

    return build_audio_response(
        audio.id, audio.filename, generate_signed_url(audio.object_key),
        audio.file_size, audio.duration, audio.status.value,
        audio.created_at.isoformat(), audio.updated_at.isoformat(),
    )


def update_duration(audio_id: str, duration: int, current_user: User, db: Session) -> dict:
    audio = audio_dao.get_by_id(db, audio_id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if not can_access_audio(audio, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    audio_dao.update_duration(db, audio, duration)
    return {"duration": audio.duration}


def delete_audio(audio_id: str, current_user: User, db: Session) -> dict:
    audio = audio_dao.get_by_id_and_user(db, audio_id, current_user.id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")

    try:
        storage_client = get_storage_client()
        storage_client.storage.from_(STORAGE_BUCKET).remove([audio.object_key])
    except Exception:
        pass

    audio_dao.delete(db, audio)
    return {"message": "Audio file deleted successfully"}


def test_url(audio_id: str, current_user: User, db: Session) -> dict:
    audio = audio_dao.get_by_id_and_user(db, audio_id, current_user.id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    try:
        url = generate_signed_url(audio.object_key)
        return {"object_key": audio.object_key, "url": url, "url_length": len(url)}
    except Exception as e:
        return {"error": str(e), "object_key": audio.object_key}
