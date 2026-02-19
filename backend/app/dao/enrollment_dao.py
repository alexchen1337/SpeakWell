from sqlalchemy.orm import Session

from app.models import Enrollment


class EnrollmentDAO:
    def create(self, db: Session, enrollment: Enrollment) -> Enrollment:
        db.add(enrollment)
        db.commit()
        return enrollment

    def get_by_class_and_student(self, db: Session, class_id: str, student_id: str) -> Enrollment | None:
        return db.query(Enrollment).filter(
            Enrollment.class_id == class_id,
            Enrollment.student_id == student_id,
        ).first()

    def list_by_class(self, db: Session, class_id: str) -> list[Enrollment]:
        return db.query(Enrollment).filter(
            Enrollment.class_id == class_id
        ).order_by(Enrollment.created_at.desc()).all()

    def list_by_student(self, db: Session, student_id: str) -> list[Enrollment]:
        return db.query(Enrollment).filter(
            Enrollment.student_id == student_id
        ).order_by(Enrollment.created_at.desc()).all()

    def count_by_class(self, db: Session, class_id: str) -> int:
        return db.query(Enrollment).filter(Enrollment.class_id == class_id).count()

    def delete(self, db: Session, enrollment: Enrollment) -> None:
        db.delete(enrollment)
        db.commit()


enrollment_dao = EnrollmentDAO()
