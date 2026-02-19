from typing import Optional

from sqlalchemy.orm import Session

from app.models import Grading, GradingStatus


class GradingDAO:
    def create(self, db: Session, grading: Grading) -> Grading:
        db.add(grading)
        db.commit()
        db.refresh(grading)
        return grading

    def get_by_id(self, db: Session, grading_id: str) -> Grading | None:
        return db.query(Grading).filter(Grading.id == grading_id).first()

    def list_by_transcript(self, db: Session, transcript_id: str, official_only: bool = False) -> list[Grading]:
        query = db.query(Grading).filter(Grading.transcript_id == transcript_id)
        if official_only:
            query = query.filter(Grading.is_official == 1)
        return query.all()

    def list_filtered(
        self, db: Session,
        transcript_ids: list[str],
        source_type: Optional[str] = None,
        context_type: Optional[str] = None,
        class_id: Optional[str] = None,
        only_official: Optional[bool] = None,
    ) -> list[Grading]:
        query = db.query(Grading).filter(Grading.transcript_id.in_(transcript_ids))
        if source_type and source_type in ("self", "instructor"):
            query = query.filter(Grading.source_type == source_type)
        if context_type and context_type in ("practice", "class"):
            query = query.filter(Grading.context_type == context_type)
        if class_id:
            query = query.filter(Grading.context_id == class_id)
        if only_official is not None:
            query = query.filter(Grading.is_official == (1 if only_official else 0))
        return query.order_by(Grading.created_at.desc()).all()

    def list_by_transcript_ids_official(self, db: Session, transcript_ids: list[str]) -> list[Grading]:
        if not transcript_ids:
            return []
        return db.query(Grading).filter(
            Grading.transcript_id.in_(transcript_ids),
            Grading.is_official == 1,
        ).order_by(Grading.created_at.desc()).all()

    def list_completed_official(self, db: Session, transcript_ids: list[str]) -> list[Grading]:
        if not transcript_ids:
            return []
        return db.query(Grading).filter(
            Grading.transcript_id.in_(transcript_ids),
            Grading.status == GradingStatus.completed,
            Grading.is_official == 1,
        ).all()

    def get_existing(self, db: Session, transcript_id: str, rubric_id: str) -> Grading | None:
        return db.query(Grading).filter(
            Grading.transcript_id == transcript_id,
            Grading.rubric_id == rubric_id,
        ).first()

    def delete(self, db: Session, grading: Grading) -> None:
        db.delete(grading)
        db.commit()

    def save(self, db: Session, grading: Grading) -> None:
        db.commit()
        db.refresh(grading)

    def get_latest_official_for_transcript(self, db: Session, transcript_id: str) -> Grading | None:
        return db.query(Grading).filter(
            Grading.transcript_id == transcript_id,
            Grading.is_official == 1,
            Grading.status == GradingStatus.completed,
        ).order_by(Grading.created_at.desc()).first()

    def get_latest_for_transcript(self, db: Session, transcript_id: str) -> Grading | None:
        return db.query(Grading).filter(
            Grading.transcript_id == transcript_id,
        ).order_by(Grading.created_at.desc()).first()

    def get_latest_official_any_status(self, db: Session, transcript_id: str) -> Grading | None:
        return db.query(Grading).filter(
            Grading.transcript_id == transcript_id,
            Grading.is_official == 1,
        ).order_by(Grading.created_at.desc()).first()


grading_dao = GradingDAO()
