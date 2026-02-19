from sqlalchemy.orm import Session

from app.models import Rubric, RubricCriterion, RubricType


class RubricDAO:
    def list_accessible(self, db: Session, user_id: str) -> list[Rubric]:
        return db.query(Rubric).filter(
            (Rubric.rubric_type == RubricType.built_in) |
            (Rubric.user_id == user_id)
        ).all()

    def get_by_id(self, db: Session, rubric_id: str) -> Rubric | None:
        return db.query(Rubric).filter(Rubric.id == rubric_id).first()

    def create(self, db: Session, rubric: Rubric, criteria: list[RubricCriterion]) -> Rubric:
        db.add(rubric)
        db.add_all(criteria)
        db.commit()
        db.refresh(rubric)
        return rubric

    def update(self, db: Session, rubric: Rubric) -> Rubric:
        db.commit()
        db.refresh(rubric)
        return rubric

    def replace_criteria(self, db: Session, rubric_id: str, new_criteria: list[RubricCriterion]) -> None:
        db.query(RubricCriterion).filter(RubricCriterion.rubric_id == rubric_id).delete()
        db.add_all(new_criteria)

    def delete(self, db: Session, rubric: Rubric) -> None:
        db.delete(rubric)
        db.commit()

    def get_criteria_by_rubric(self, db: Session, rubric_id: str) -> list[RubricCriterion]:
        return db.query(RubricCriterion).filter(
            RubricCriterion.rubric_id == rubric_id
        ).order_by(RubricCriterion.order_index).all()

    def get_by_ids(self, db: Session, rubric_ids: list[str]) -> list[Rubric]:
        if not rubric_ids:
            return []
        return db.query(Rubric).filter(Rubric.id.in_(rubric_ids)).all()


rubric_dao = RubricDAO()
