from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
import uuid

from database import get_db, User, Rubric, RubricCriterion, RubricType
from auth import get_current_user

router = APIRouter(prefix="/api/rubrics", tags=["rubrics"])


class CriterionRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: str
    max_score: int = Field(..., gt=0)
    weight: float = Field(..., gt=0)

    @field_validator('max_score')
    @classmethod
    def validate_max_score(cls, v):
        if v <= 0:
            raise ValueError('Max score must be a positive number')
        return v

    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v):
        if v <= 0:
            raise ValueError('Weight must be a positive number')
        return v


class RubricCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    criteria: List[CriterionRequest] = Field(..., min_length=1)


class RubricUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    criteria: Optional[List[CriterionRequest]] = Field(None, min_length=1)


class CriterionResponse(BaseModel):
    id: str
    name: str
    description: str
    maxScore: int = Field(alias="maxScore")
    weight: float
    orderIndex: int = Field(alias="orderIndex")

    class Config:
        from_attributes = True
        populate_by_name = True


class RubricResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    rubricType: str = Field(alias="rubricType")
    createdAt: str = Field(alias="createdAt")
    criteria: List[CriterionResponse]

    class Config:
        from_attributes = True
        populate_by_name = True


def build_criterion_response(c: RubricCriterion) -> CriterionResponse:
    """Build a CriterionResponse from a RubricCriterion object."""
    return CriterionResponse(
        id=c.id,
        name=c.name,
        description=c.description,
        maxScore=c.max_score,
        weight=c.weight,
        orderIndex=c.order_index
    )


def build_rubric_response(r: Rubric, criteria_list: List[RubricCriterion] = None) -> RubricResponse:
    """Build a RubricResponse from a Rubric object."""
    criteria = criteria_list if criteria_list is not None else r.criteria
    return RubricResponse(
        id=r.id,
        name=r.name,
        description=r.description,
        rubricType=r.rubric_type.value,
        createdAt=r.created_at.isoformat(),
        criteria=[build_criterion_response(c) for c in criteria]
    )


@router.get("", response_model=List[RubricResponse])
def list_rubrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all rubrics (built-in + user's custom rubrics)."""
    rubrics = db.query(Rubric).filter(
        (Rubric.rubric_type == RubricType.built_in) |
        (Rubric.user_id == current_user.id)
    ).all()

    return [build_rubric_response(r) for r in rubrics]


@router.get("/{rubric_id}", response_model=RubricResponse)
def get_rubric(
    rubric_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rubric with criteria."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # Check access
    if rubric.rubric_type == RubricType.custom and rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return build_rubric_response(rubric)


@router.post("", response_model=RubricResponse, status_code=201)
def create_rubric(
    request: RubricCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a custom rubric."""
    rubric_id = str(uuid.uuid4())

    rubric = Rubric(
        id=rubric_id,
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        rubric_type=RubricType.custom
    )

    criteria = [
        RubricCriterion(
            id=str(uuid.uuid4()),
            rubric_id=rubric_id,
            name=c.name,
            description=c.description,
            max_score=c.max_score,
            weight=c.weight,
            order_index=idx
        )
        for idx, c in enumerate(request.criteria)
    ]

    db.add(rubric)
    db.add_all(criteria)
    db.commit()
    db.refresh(rubric)

    return build_rubric_response(rubric, criteria)


@router.put("/{rubric_id}", response_model=RubricResponse)
def update_rubric(
    rubric_id: str,
    request: RubricUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a custom rubric (owner only)."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # Check ownership and type
    if rubric.rubric_type == RubricType.built_in:
        raise HTTPException(status_code=403, detail="Cannot modify built-in rubrics")

    if rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update rubric fields
    if request.name is not None:
        rubric.name = request.name
    if request.description is not None:
        rubric.description = request.description

    # Update criteria if provided
    if request.criteria is not None:
        # Delete old criteria
        db.query(RubricCriterion).filter(RubricCriterion.rubric_id == rubric_id).delete()

        # Create new criteria
        new_criteria = [
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name=c.name,
                description=c.description,
                max_score=c.max_score,
                weight=c.weight,
                order_index=idx
            )
            for idx, c in enumerate(request.criteria)
        ]
        db.add_all(new_criteria)

    db.commit()
    db.refresh(rubric)

    return build_rubric_response(rubric)


@router.delete("/{rubric_id}", status_code=204)
def delete_rubric(
    rubric_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a custom rubric (owner only)."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # Check ownership and type
    if rubric.rubric_type == RubricType.built_in:
        raise HTTPException(status_code=403, detail="Cannot delete built-in rubrics")

    if rubric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(rubric)
    db.commit()
