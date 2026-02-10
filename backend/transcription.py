from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
import os
import uuid
import io
import sys
import traceback
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

from database import get_db, User, AudioFile, Transcript, AudioStatus, Classroom
from auth import get_current_user
from audio import download_file


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

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def get_openai_client():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    return OpenAI(api_key=OPENAI_API_KEY)


def transcribe_audio_file(audio_file_id: str, object_key: str, filename: str):
    """Background task to transcribe audio using OpenAI Whisper"""
    from database import SessionLocal
    
    db = SessionLocal()
    try:
        audio = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio:
            print(f"[Transcription] Audio file {audio_file_id} not found", file=sys.stderr)
            return
        
        audio.status = AudioStatus.processing
        audio.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"[Transcription] Starting for {filename}")
        
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        audio_bytes = download_file(object_key)
        
        print(f"[Transcription] Downloaded {len(audio_bytes)} bytes from storage")
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, io.BytesIO(audio_bytes)),
            response_format="verbose_json",
            timestamp_granularities=["word"]
        )
        
        print(f"[Transcription] OpenAI returned: {len(transcription.text)} chars")
        
        import random
        words = []
        if hasattr(transcription, "words") and transcription.words:
            for idx, w in enumerate(transcription.words):
                word_data = {}
                if isinstance(w, dict):
                    word_data = {"word": w.get("word", ""), "start": w.get("start", 0), "end": w.get("end", 0)}
                else:
                    word_data = {"word": w.word, "start": w.start, "end": w.end}
                
                # randomize deception tags: ~1 in 12 words gets tagged
                if idx > 0 and random.random() < 0.083:
                    word_data["deceptionConfidence"] = random.choice(["medium", "high"])
                else:
                    word_data["deceptionConfidence"] = None
                
                words.append(word_data)
        
        transcript = Transcript(
            id=str(uuid.uuid4()),
            audio_file_id=audio_file_id,
            text=transcription.text,
            word_timestamps={"words": words},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(transcript)
        audio.status = AudioStatus.completed
        audio.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"[Transcription] Completed for {filename}")
        
    except Exception as e:
        print(f"[Transcription] ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        traceback.print_exc()
        db.rollback()
        audio = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if audio:
            audio.status = AudioStatus.failed
            audio.updated_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.get("/{audio_id}")
async def get_transcript(
    audio_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not can_access_audio(audio, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    transcript = db.query(Transcript).filter(Transcript.audio_file_id == audio_id).first()
    
    if not transcript:
        return {
            "audio_id": audio_id,
            "status": audio.status.value,
            "transcript": None
        }
    
    return {
        "audio_id": audio_id,
        "status": audio.status.value,
        "transcript": {
            "id": transcript.id,
            "text": transcript.text,
            "words": transcript.word_timestamps.get("words", []) if transcript.word_timestamps else [],
            "createdAt": transcript.created_at.isoformat(),
        }
    }


@router.post("/{audio_id}/retry")
async def retry_transcription(
    audio_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio = db.query(AudioFile).filter(
        AudioFile.id == audio_id,
        AudioFile.user_id == current_user.id
    ).first()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if audio.status == AudioStatus.processing:
        raise HTTPException(status_code=400, detail="Transcription already in progress")
    
    existing = db.query(Transcript).filter(Transcript.audio_file_id == audio_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    
    background_tasks.add_task(
        transcribe_audio_file,
        audio.id,
        audio.object_key,
        audio.filename
    )
    
    return {"message": "Transcription started", "status": "processing"}


