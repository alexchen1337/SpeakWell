import uuid
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Rubric, RubricCriterion, RubricType, User
from app.schemas.rubric import (
    RubricCreateRequest, RubricUpdateRequest,
    RubricResponse, CriterionResponse,
)
from app.dao.rubric_dao import rubric_dao


def build_criterion_response(c: RubricCriterion) -> CriterionResponse:
    return CriterionResponse(
        id=c.id,
        name=c.name,
        description=c.description,
        maxScore=c.max_score,
        weight=c.weight,
        orderIndex=c.order_index,
    )


def build_rubric_response(r: Rubric, criteria_list: list[RubricCriterion] | None = None) -> RubricResponse:
    criteria = criteria_list if criteria_list is not None else r.criteria
    return RubricResponse(
        id=r.id,
        name=r.name,
        description=r.description,
        rubricType=r.rubric_type.value,
        createdAt=r.created_at.isoformat(),
        criteria=[build_criterion_response(c) for c in criteria],
    )


def list_rubrics(current_user: User, db: Session) -> List[RubricResponse]:
    rubrics = rubric_dao.list_accessible(db, current_user.id)
    return [build_rubric_response(r) for r in rubrics]


def get_rubric(rubric_id: str, current_user: User, db: Session) -> RubricResponse:
    rubric = rubric_dao.get_by_id(db, rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    if rubric.rubric_type == RubricType.custom and rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return build_rubric_response(rubric)


def create_rubric(request: RubricCreateRequest, current_user: User, db: Session) -> RubricResponse:
    total_weight = sum(c.weight for c in request.criteria)
    if total_weight <= 0:
        raise HTTPException(status_code=400, detail="Total weight must be greater than 0")

    rubric_id = str(uuid.uuid4())
    rubric = Rubric(
        id=rubric_id,
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        rubric_type=RubricType.custom,
    )

    criteria = [
        RubricCriterion(
            id=str(uuid.uuid4()),
            rubric_id=rubric_id,
            name=c.name,
            description=c.description,
            max_score=c.max_score,
            weight=c.weight,
            order_index=idx,
        )
        for idx, c in enumerate(request.criteria)
    ]

    rubric_dao.create(db, rubric, criteria)
    return build_rubric_response(rubric, criteria)


def update_rubric(rubric_id: str, request: RubricUpdateRequest, current_user: User, db: Session) -> RubricResponse:
    rubric = rubric_dao.get_by_id(db, rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    if rubric.rubric_type == RubricType.built_in:
        raise HTTPException(status_code=403, detail="Cannot modify built-in rubrics")
    if rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if request.name is not None:
        rubric.name = request.name
    if request.description is not None:
        rubric.description = request.description

    if request.criteria is not None:
        total_weight = sum(c.weight for c in request.criteria)
        if total_weight <= 0:
            raise HTTPException(status_code=400, detail="Total weight must be greater than 0")

        new_criteria = [
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name=c.name,
                description=c.description,
                max_score=c.max_score,
                weight=c.weight,
                order_index=idx,
            )
            for idx, c in enumerate(request.criteria)
        ]
        rubric_dao.replace_criteria(db, rubric_id, new_criteria)

    rubric_dao.update(db, rubric)
    return build_rubric_response(rubric)


def delete_rubric(rubric_id: str, current_user: User, db: Session):
    rubric = rubric_dao.get_by_id(db, rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    if rubric.rubric_type == RubricType.built_in:
        raise HTTPException(status_code=403, detail="Cannot delete built-in rubrics")
    if rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    rubric_dao.delete(db, rubric)


def seed_abet_rubric():
    from app.models import SessionLocal
    db = SessionLocal()
    try:
        existing = db.query(Rubric).filter(
            Rubric.rubric_type == RubricType.built_in,
            Rubric.name == "ABET Presentation Rubric",
        ).first()
        if existing:
            return

        rubric_id = str(uuid.uuid4())
        abet_rubric = Rubric(
            id=rubric_id,
            user_id=None,
            name="ABET Presentation Rubric",
            description="Standard ABET rubric for evaluating technical presentations",
            rubric_type=RubricType.built_in,
        )

        criteria = [
            RubricCriterion(id=str(uuid.uuid4()), rubric_id=rubric_id, name="Technical Content", description="Demonstrates depth of technical knowledge, accuracy of information, and appropriate use of terminology", max_score=5, weight=3.0, order_index=0),
            RubricCriterion(id=str(uuid.uuid4()), rubric_id=rubric_id, name="Organization & Structure", description="Clear introduction, logical flow of ideas, smooth transitions, and effective conclusion", max_score=5, weight=2.0, order_index=1),
            RubricCriterion(id=str(uuid.uuid4()), rubric_id=rubric_id, name="Communication Clarity", description="Clear articulation, appropriate volume and pace, minimal filler words, professional language", max_score=5, weight=2.0, order_index=2),
            RubricCriterion(id=str(uuid.uuid4()), rubric_id=rubric_id, name="Evidence & Support", description="Uses relevant examples, data, and citations to support claims and arguments", max_score=5, weight=2.0, order_index=3),
            RubricCriterion(id=str(uuid.uuid4()), rubric_id=rubric_id, name="Audience Engagement", description="Maintains audience interest, addresses audience needs, and demonstrates awareness of audience level", max_score=5, weight=1.0, order_index=4),
        ]

        db.add(abet_rubric)
        db.add_all(criteria)
        db.commit()
        print("ABET rubric seeded successfully")
    except Exception as e:
        db.rollback()
        print(f"Error seeding ABET rubric: {e}")
    finally:
        db.close()
