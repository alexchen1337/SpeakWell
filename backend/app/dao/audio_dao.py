from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AudioFile, AudioStatus


class AudioDAO:
    def create(self, db: Session, audio_file: AudioFile) -> AudioFile:
        db.add(audio_file)
        db.commit()
        db.refresh(audio_file)
        return audio_file

    def get_by_id(self, db: Session, audio_id: str) -> AudioFile | None:
        return db.query(AudioFile).filter(AudioFile.id == audio_id).first()

    def get_by_id_and_user(self, db: Session, audio_id: str, user_id: str) -> AudioFile | None:
        return db.query(AudioFile).filter(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        ).first()

    def list_by_user(
        self, db: Session, user_id: str,
        status: Optional[AudioStatus] = None,
        skip: int = 0, limit: int = 100,
    ) -> list[AudioFile]:
        query = db.query(AudioFile).filter(AudioFile.user_id == user_id)
        if status:
            query = query.filter(AudioFile.status == status)
        return query.order_by(AudioFile.created_at.desc()).offset(skip).limit(limit).all()

    def list_by_class(self, db: Session, class_id: str) -> list[AudioFile]:
        return db.query(AudioFile).filter(AudioFile.class_id == class_id).order_by(AudioFile.created_at.desc()).all()

    def list_by_class_and_user(self, db: Session, class_id: str, user_id: str) -> list[AudioFile]:
        return db.query(AudioFile).filter(
            AudioFile.class_id == class_id,
            AudioFile.user_id == user_id,
        ).order_by(AudioFile.created_at.desc()).all()

    def update_filename(self, db: Session, audio: AudioFile, filename: str) -> AudioFile:
        audio.filename = filename
        audio.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(audio)
        return audio

    def update_duration(self, db: Session, audio: AudioFile, duration: int) -> None:
        if audio.duration is None:
            audio.duration = duration
            audio.updated_at = datetime.utcnow()
            db.commit()

    def update_status(self, db: Session, audio: AudioFile, status: AudioStatus) -> None:
        audio.status = status
        audio.updated_at = datetime.utcnow()
        db.commit()

    def delete(self, db: Session, audio: AudioFile) -> None:
        db.delete(audio)
        db.commit()

    def check_filename_exists(self, db: Session, user_id: str, filename: str, exclude_id: str | None = None) -> bool:
        query = db.query(AudioFile).filter(
            AudioFile.user_id == user_id,
            AudioFile.filename == filename,
        )
        if exclude_id:
            query = query.filter(AudioFile.id != exclude_id)
        return query.first() is not None

    def list_by_user_ids(self, db: Session, audio_file_ids: list[str]) -> list[AudioFile]:
        if not audio_file_ids:
            return []
        return db.query(AudioFile).filter(AudioFile.id.in_(audio_file_ids)).all()


audio_dao = AudioDAO()
