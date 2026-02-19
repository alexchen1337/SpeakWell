from sqlalchemy.orm import Session

from app.models import Classroom


class ClassroomDAO:
    def create(self, db: Session, classroom: Classroom) -> Classroom:
        db.add(classroom)
        db.commit()
        db.refresh(classroom)
        return classroom

    def get_by_id(self, db: Session, class_id: str) -> Classroom | None:
        return db.query(Classroom).filter(Classroom.id == class_id).first()

    def get_by_join_code(self, db: Session, join_code: str) -> Classroom | None:
        return db.query(Classroom).filter(Classroom.join_code == join_code).first()

    def list_by_instructor(self, db: Session, instructor_id: str) -> list[Classroom]:
        return db.query(Classroom).filter(
            Classroom.instructor_id == instructor_id
        ).order_by(Classroom.created_at.desc()).all()

    def delete(self, db: Session, classroom: Classroom) -> None:
        db.delete(classroom)
        db.commit()

    def get_by_ids(self, db: Session, class_ids: list[str]) -> list[Classroom]:
        if not class_ids:
            return []
        return db.query(Classroom).filter(Classroom.id.in_(class_ids)).all()


classroom_dao = ClassroomDAO()
