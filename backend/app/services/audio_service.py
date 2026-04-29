import io
import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import STORAGE_BUCKET
from app.core.dependencies import get_storage_client, generate_signed_url
from app.models import AudioFile, AudioStatus, User
from app.dao.audio_dao import audio_dao
from app.dao.classroom_dao import classroom_dao
from app.dao.enrollment_dao import enrollment_dao
from app.schemas.audio import build_audio_response

try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
SUPPORTED_VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "video/webm",
}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
SUPPORTED_AUDIO_EXTENSIONS = {
    ".aac",
    ".aif",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".oga",
    ".ogg",
    ".opus",
    ".wav",
    ".wma",
}
EXTENSION_CONTENT_TYPES = {
    ".aac": "audio/aac",
    ".aif": "audio/aiff",
    ".aiff": "audio/aiff",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".oga": "audio/ogg",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".wav": "audio/wav",
    ".wma": "audio/x-ms-wma",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".webm": "video/webm",
}
GENERIC_CONTENT_TYPES = {"", "application/octet-stream", "binary/octet-stream"}


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


def _normalize_content_type(content_type: Optional[str]) -> str:
    if not content_type:
        return ""
    return content_type.split(";")[0].strip().lower()


def _get_extension(filename: Optional[str]) -> str:
    return os.path.splitext(filename or "")[1].lower()


def is_video_filename(filename: Optional[str]) -> bool:
    return _get_extension(filename) in SUPPORTED_VIDEO_EXTENSIONS


def _resolve_media_type(file: UploadFile) -> Optional[str]:
    normalized_type = _normalize_content_type(file.content_type)
    extension = _get_extension(file.filename)

    if normalized_type.startswith("audio/"):
        return "audio"
    if normalized_type in SUPPORTED_VIDEO_MIME_TYPES:
        return "video"

    if extension in SUPPORTED_AUDIO_EXTENSIONS:
        return "audio"
    if extension in SUPPORTED_VIDEO_EXTENSIONS:
        return "video"

    return None


def _resolve_upload_content_type(file: UploadFile, media_type: str) -> str:
    extension = _get_extension(file.filename)
    if extension in EXTENSION_CONTENT_TYPES:
        return EXTENSION_CONTENT_TYPES[extension]

    normalized_type = _normalize_content_type(file.content_type)
    if normalized_type not in GENERIC_CONTENT_TYPES:
        return normalized_type

    return "video/mp4" if media_type == "video" else "audio/mpeg"


def _ensure_filename(filename: Optional[str], media_type: str, fallback_stem: str = "upload") -> str:
    if filename and filename.strip():
        return filename
    default_extension = ".mp4" if media_type == "video" else ".mp3"
    return f"{fallback_stem}{default_extension}"


def _convert_video_to_mp3(file_contents: bytes, filename: str) -> tuple[bytes, str]:
    extension = os.path.splitext(filename)[1].lower() or ".mp4"
    stem = os.path.splitext(os.path.basename(filename))[0] or "video"
    input_path = None
    output_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as input_file:
            input_file.write(file_contents)
            input_path = input_file.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as output_file:
            output_path = output_file.name

        try:
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    input_path,
                    "-vn",
                    "-acodec",
                    "libmp3lame",
                    "-q:a",
                    "2",
                    output_path,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError as exc:
            raise ValueError("Video conversion failed: ffmpeg is not installed") from exc
        if result.returncode != 0:
            error_message = (result.stderr or "Unknown ffmpeg error").strip()
            raise ValueError(f"Video conversion failed: {error_message}")

        with open(output_path, "rb") as output_file:
            audio_bytes = output_file.read()
        if not audio_bytes:
            raise ValueError("Video conversion failed: extracted audio is empty")

        return audio_bytes, f"{stem}.mp3"
    finally:
        if input_path and os.path.exists(input_path):
            os.unlink(input_path)
        if output_path and os.path.exists(output_path):
            os.unlink(output_path)


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
            media_type = _resolve_media_type(file)
            if not media_type:
                failed_files.append(
                    {
                        "filename": file.filename,
                        "error": "Unsupported file type. Use audio files or video files.",
                    }
                )
                continue
            if file.size and file.size > MAX_UPLOAD_BYTES:
                failed_files.append({"filename": file.filename, "error": "File too large (max 100MB)"})
                continue

            source_filename = _ensure_filename(file.filename, media_type)
            source_contents = await file.read()
            if not source_contents:
                failed_files.append({"filename": file.filename, "error": "Empty file"})
                continue
            if len(source_contents) > MAX_UPLOAD_BYTES:
                failed_files.append({"filename": file.filename, "error": "File too large (max 100MB)"})
                continue

            upload_contents = source_contents
            upload_filename = source_filename
            upload_content_type = _resolve_upload_content_type(file, media_type)

            file_id = str(uuid.uuid4())
            file_extension = os.path.splitext(upload_filename)[1] or ".mp3"
            object_key = f"{current_user.id}/{file_id}{file_extension}"

            storage_client.storage.from_(STORAGE_BUCKET).upload(
                path=object_key,
                file=upload_contents,
                file_options={
                    "content-type": upload_content_type,
                    "cache-control": "public, max-age=31536000",
                },
            )

            file_size = len(upload_contents)
            duration = extract_audio_duration(upload_contents, upload_filename)
            unique_filename = get_unique_filename(db, current_user.id, upload_filename)

            audio_file = AudioFile(
                id=file_id,
                user_id=current_user.id,
                object_key=object_key,
                media_type=media_type,
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
