from typing import Optional, List, Annotated, Union

from pydantic import BaseModel, Field, BeforeValidator


def coerce_to_float(v: Union[int, float, str]) -> float:
    if isinstance(v, (int, float)):
        result = float(v)
        if result <= 0:
            raise ValueError('Must be a positive number')
        return result
    if isinstance(v, str):
        try:
            result = float(v)
            if result <= 0:
                raise ValueError('Must be a positive number')
            return result
        except ValueError as e:
            if 'positive' in str(e):
                raise
            raise ValueError('Must be a valid number')
    raise ValueError('Must be a number')


PositiveFloat = Annotated[float, BeforeValidator(coerce_to_float)]


class CriterionRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: str
    max_score: PositiveFloat = Field(..., gt=0)
    weight: PositiveFloat = Field(..., gt=0)


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
    maxScore: float = Field(alias="maxScore")
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
