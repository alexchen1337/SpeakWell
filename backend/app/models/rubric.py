from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import RubricType


class Rubric(Base):
    __tablename__ = "rubrics"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rubric_type = Column(SQLEnum(RubricType), nullable=False, default=RubricType.custom)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="rubrics")
    criteria = relationship("RubricCriterion", back_populates="rubric", cascade="all, delete-orphan", order_by="RubricCriterion.order_index")
    gradings = relationship("Grading", back_populates="rubric")


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id = Column(String(36), primary_key=True)
    rubric_id = Column(String(36), ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    max_score = Column(Float, nullable=False)
    weight = Column(Float, nullable=False)
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())

    rubric = relationship("Rubric", back_populates="criteria")
