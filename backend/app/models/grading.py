from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import GradingStatus


class Grading(Base):
    __tablename__ = "gradings"

    id = Column(String(36), primary_key=True)
    transcript_id = Column(String(36), ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    rubric_id = Column(String(36), ForeignKey("rubrics.id", ondelete="SET NULL"), nullable=True, index=True)
    graded_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(GradingStatus), nullable=False, default=GradingStatus.processing)
    overall_score = Column(Float, nullable=True)
    max_possible_score = Column(Float, nullable=True)

    source_type = Column(String(20), nullable=False, default="self", index=True)
    context_type = Column(String(20), nullable=False, default="practice", index=True)
    context_id = Column(String(36), nullable=True, index=True)
    is_official = Column(Integer, nullable=False, default=0)

    pacing_wpm_avg = Column(Float, nullable=True)
    pacing_wpm_variance = Column(Float, nullable=True)
    pacing_pause_count = Column(Integer, nullable=True)
    pacing_score = Column(Float, nullable=True)

    clarity_filler_word_count = Column(Integer, nullable=True)
    clarity_filler_word_percentage = Column(Float, nullable=True)
    clarity_nonsensical_word_count = Column(Integer, nullable=True)
    clarity_score = Column(Float, nullable=True)

    detailed_results = Column(JSON, nullable=True)

    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    transcript = relationship("Transcript", back_populates="gradings")
    rubric = relationship("Rubric", back_populates="gradings")
    graded_by = relationship("User", foreign_keys=[graded_by_user_id])
