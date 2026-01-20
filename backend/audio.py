from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from supabase import create_client, Client
import os
import uuid
import io
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

from database import get_db, User, AudioFile, AudioStatus, Classroom, Enrollment
from auth import get_current_user

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

router = APIRouter(prefix="/api/audio", tags=["audio"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "audio-files")
SIGNED_URL_EXPIRES_IN = int(os.getenv("SIGNED_URL_EXPIRES_IN", "7200"))

_storage_client: Optional[Client] = None


def get_storage_client() -> Client:
    global _storage_client
    if _storage_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(status_code=500, detail="Supabase storage not configured")
        _storage_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _storage_client


def extract_audio_duration(file_contents: bytes, filename: str) -> Optional[int]:
    if not MUTAGEN_AVAILABLE:
        return None
    
    try:
        audio_file = MutagenFile(io.BytesIO(file_contents), easy=True)
        if audio_file and hasattr(audio_file.info, "length"):
            return int(audio_file.info.length)
    except Exception:
        return None
    
    return None


def generate_signed_url(object_key: str) -> str:
    try:
        client = get_storage_client()
        response = client.storage.from_(STORAGE_BUCKET).create_signed_url(
            object_key,
            SIGNED_URL_EXPIRES_IN
        )
        if response and "signedURL" in response:
            return response["signedURL"]
        return ""
    except Exception:
        return ""


def download_file(object_key: str) -> bytes:
    """Download file from Supabase Storage"""
    client = get_storage_client()
    response = client.storage.from_(STORAGE_BUCKET).download(object_key)
    return response


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


def get_unique_filename(db: Session, user_id: str, filename: str) -> str:
    """Generate a unique filename for the user by appending a number if needed."""
    # Check if filename already exists
    existing = db.query(AudioFile).filter(
        AudioFile.user_id == user_id,
        AudioFile.filename == filename
    ).first()
    
    if not existing:
        return filename
    
    # Extract base name and extension
    base_name = filename
    extension = ""
    if "." in filename:
        last_dot = filename.rfind(".")
        base_name = filename[:last_dot]
        extension = filename[last_dot:]
    
    # Find a unique name by appending numbers
    counter = 1
    while True:
        new_filename = f"{base_name} ({counter}){extension}"
        existing = db.query(AudioFile).filter(
            AudioFile.user_id == user_id,
            AudioFile.filename == new_filename
        ).first()
        if not existing:
            return new_filename
        counter += 1
        if counter > 100:  # Safety limit
            return f"{base_name} ({uuid.uuid4().hex[:8]}){extension}"


@router.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks,
    audio: List[UploadFile] = File(...),
    class_id: Optional[str] = Query(None, description="Optional class ID to associate uploads with"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not audio:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(audio) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per upload")
    
    # Validate class_id if provided
    validated_class_id = None
    if class_id:
        classroom = db.query(Classroom).filter(Classroom.id == class_id).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found")
        
        # Check permissions: students must be enrolled, instructors must own the class
        if current_user.role == "student":
            enrollment = db.query(Enrollment).filter(
                Enrollment.class_id == class_id,
                Enrollment.student_id == current_user.id
            ).first()
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
    
    for file in audio:
        object_key = None
        try:
            if not file.content_type or not file.content_type.startswith("audio/"):
                failed_files.append({
                    "filename": file.filename,
                    "error": "Not an audio file"
                })
                continue
            
            if file.size and file.size > 100 * 1024 * 1024:
                failed_files.append({
                    "filename": file.filename,
                    "error": "File too large (max 100MB)"
                })
                continue
            
            file_id = str(uuid.uuid4())
            file_extension = os.path.splitext(file.filename)[1]
            object_key = f"{current_user.id}/{file_id}{file_extension}"
            
            contents = await file.read()
            if not contents:
                failed_files.append({
                    "filename": file.filename,
                    "error": "Empty file"
                })
                continue
            
            storage_client.storage.from_(STORAGE_BUCKET).upload(
                path=object_key,
                file=contents,
                file_options={
                    "content-type": file.content_type,
                    "cache-control": "public, max-age=31536000",
                }
            )
            
            file_size = len(contents)
            duration = extract_audio_duration(contents, file.filename)
            
            # Generate unique filename if duplicate exists
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
                updated_at=datetime.utcnow()
            )
            
            db.add(audio_file)
            db.commit()
            db.refresh(audio_file)
            
            # trigger background transcription
            from transcription import transcribe_audio_file
            background_tasks.add_task(
                transcribe_audio_file,
                audio_file.id,
                audio_file.object_key,
                audio_file.filename
            )
            
            secure_url = generate_signed_url(object_key)
            
            uploaded_files.append({
                "id": audio_file.id,
                "title": unique_filename,
                "filename": unique_filename,
                "url": secure_url,
                "size": audio_file.file_size,
                "duration": audio_file.duration,
                "status": audio_file.status.value,
                "uploadedAt": audio_file.created_at.isoformat(),
            })
            
        except Exception as e:
            db.rollback()
            failed_files.append({
                "filename": file.filename,
                "error": str(e)
            })
            
            if object_key:
                try:
                    storage_client.storage.from_(STORAGE_BUCKET).remove([object_key])
                except Exception:
                    pass
    
    if not uploaded_files and failed_files:
        error_details = "; ".join([f"{f['filename']}: {f['error']}" for f in failed_files])
        raise HTTPException(
            status_code=400,
            detail=f"All uploads failed - {error_details}"
        )
    
    return uploaded_files


@router.get("")
async def get_all_audio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None
):
    query = db.query(AudioFile).filter(AudioFile.user_id == current_user.id)
    
    if status:
        try:
            status_enum = AudioStatus[status]
            query = query.filter(AudioFile.status == status_enum)
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    audio_files = query.order_by(AudioFile.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": audio.id,
            "title": audio.filename,
            "filename": audio.filename,
            "url": generate_signed_url(audio.object_key),
            "size": audio.file_size,
            "duration": audio.duration,
            "status": audio.status.value,
            "uploadedAt": audio.created_at.isoformat(),
        }
        for audio in audio_files
    ]


@router.get("/{audio_id}")
async def get_audio(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not can_access_audio(audio, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": audio.id,
        "title": audio.filename,
        "filename": audio.filename,
        "url": generate_signed_url(audio.object_key),
        "size": audio.file_size,
        "duration": audio.duration,
        "status": audio.status.value,
        "uploadedAt": audio.created_at.isoformat(),
        "updatedAt": audio.updated_at.isoformat(),
    }


@router.patch("/{audio_id}")
async def update_audio(
    audio_id: str,
    title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update audio file title/filename."""
    audio = db.query(AudioFile).filter(
        AudioFile.id == audio_id,
        AudioFile.user_id == current_user.id
    ).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not title or not title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    clean_title = title.strip()
    
    # Check for duplicate name (excluding current file)
    existing = db.query(AudioFile).filter(
        AudioFile.user_id == current_user.id,
        AudioFile.filename == clean_title,
        AudioFile.id != audio_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="A presentation with this name already exists")
    
    audio.filename = clean_title
    audio.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(audio)
    
    return {
        "id": audio.id,
        "title": audio.filename,
        "filename": audio.filename,
        "url": generate_signed_url(audio.object_key),
        "size": audio.file_size,
        "duration": audio.duration,
        "status": audio.status.value,
        "uploadedAt": audio.created_at.isoformat(),
        "updatedAt": audio.updated_at.isoformat(),
    }


@router.delete("/{audio_id}")
async def delete_audio(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio = db.query(AudioFile).filter(
        AudioFile.id == audio_id,
        AudioFile.user_id == current_user.id
    ).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    try:
        storage_client = get_storage_client()
        storage_client.storage.from_(STORAGE_BUCKET).remove([audio.object_key])
    except Exception:
        pass
    
    db.delete(audio)
    db.commit()
    
    return {"message": "Audio file deleted successfully"}


@router.get("/{audio_id}/test-url")
async def test_audio_url(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio = db.query(AudioFile).filter(
        AudioFile.id == audio_id,
        AudioFile.user_id == current_user.id
    ).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    try:
        url = generate_signed_url(audio.object_key)
        
        return {
            "object_key": audio.object_key,
            "url": url,
            "url_length": len(url),
        }
    except Exception as e:
        return {
            "error": str(e),
            "object_key": audio.object_key
        }
