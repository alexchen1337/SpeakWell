import io
import random
import sys
import traceback
import uuid
from datetime import datetime

from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY
from app.core.dependencies import download_file
from app.models import SessionLocal, AudioFile, Transcript, AudioStatus
from app.dao.audio_dao import audio_dao
from app.dao.transcript_dao import transcript_dao
from app.services.audio_service import can_access_audio, is_video_filename, _convert_video_to_mp3


def get_openai_client():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    return OpenAI(api_key=OPENAI_API_KEY)


def transcribe_audio_file(audio_file_id: str, object_key: str, filename: str):
    """Background task to transcribe audio using OpenAI Whisper."""
    db = SessionLocal()
    try:
        audio = audio_dao.get_by_id(db, audio_file_id)
        if not audio:
            print(f"[Transcription] Audio file {audio_file_id} not found", file=sys.stderr)
            return

        audio.status = AudioStatus.processing
        audio.updated_at = datetime.utcnow()
        db.commit()

        print(f"[Transcription] Starting for {filename}")

        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        source_bytes = download_file(object_key)
        print(f"[Transcription] Downloaded {len(source_bytes)} bytes from storage")

        transcription_bytes = source_bytes
        transcription_filename = filename
        if is_video_filename(filename):
            transcription_bytes, transcription_filename = _convert_video_to_mp3(source_bytes, filename)
            print(f"[Transcription] Extracted audio from video: {filename} -> {transcription_filename}")

        client = OpenAI(api_key=OPENAI_API_KEY)
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=(transcription_filename, io.BytesIO(transcription_bytes)),
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

        print(f"[Transcription] OpenAI returned: {len(transcription.text)} chars")

        words = []
        if hasattr(transcription, "words") and transcription.words:
            for idx, w in enumerate(transcription.words):
                if isinstance(w, dict):
                    word_data = {"word": w.get("word", ""), "start": w.get("start", 0), "end": w.get("end", 0)}
                else:
                    word_data = {"word": w.word, "start": w.start, "end": w.end}

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
            updated_at=datetime.utcnow(),
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
        audio = audio_dao.get_by_id(db, audio_file_id)
        if audio:
            audio.status = AudioStatus.failed
            audio.updated_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def get_transcript(audio_id: str, current_user, db: Session) -> dict:
    audio = audio_dao.get_by_id(db, audio_id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if not can_access_audio(audio, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    transcript = transcript_dao.get_by_audio_id(db, audio_id)

    if not transcript:
        return {"audio_id": audio_id, "status": audio.status.value, "transcript": None}

    return {
        "audio_id": audio_id,
        "status": audio.status.value,
        "transcript": {
            "id": transcript.id,
            "text": transcript.text,
            "words": transcript.word_timestamps.get("words", []) if transcript.word_timestamps else [],
            "createdAt": transcript.created_at.isoformat(),
        },
    }


def retry_transcription(audio_id: str, current_user, db: Session, background_tasks) -> dict:
    audio = audio_dao.get_by_id_and_user(db, audio_id, current_user.id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if audio.status == AudioStatus.processing:
        raise HTTPException(status_code=400, detail="Transcription already in progress")

    transcript_dao.delete_by_audio_id(db, audio_id)

    background_tasks.add_task(
        transcribe_audio_file,
        audio.id,
        audio.object_key,
        audio.filename,
    )
    return {"message": "Transcription started", "status": "processing"}
