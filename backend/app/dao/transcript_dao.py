from sqlalchemy.orm import Session

from app.models import Transcript


class TranscriptDAO:
    def get_by_audio_id(self, db: Session, audio_id: str) -> Transcript | None:
        return db.query(Transcript).filter(Transcript.audio_file_id == audio_id).first()

    def get_by_id(self, db: Session, transcript_id: str) -> Transcript | None:
        return db.query(Transcript).filter(Transcript.id == transcript_id).first()

    def create(self, db: Session, transcript: Transcript) -> Transcript:
        db.add(transcript)
        db.commit()
        return transcript

    def delete_by_audio_id(self, db: Session, audio_id: str) -> None:
        existing = self.get_by_audio_id(db, audio_id)
        if existing:
            db.delete(existing)
            db.commit()

    def list_by_audio_ids(self, db: Session, audio_file_ids: list[str]) -> list[Transcript]:
        if not audio_file_ids:
            return []
        return db.query(Transcript).filter(Transcript.audio_file_id.in_(audio_file_ids)).all()


transcript_dao = TranscriptDAO()
