from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class Classroom(Base):
    __tablename__ = "classes"

    id = Column(String(36), primary_key=True)
    instructor_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    join_code = Column(String(32), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    instructor = relationship(
        "User",
        back_populates="classes_taught",
        foreign_keys=[instructor_id],
    )
    enrollments = relationship(
        "Enrollment",
        back_populates="classroom",
        cascade="all, delete-orphan",
    )
    audio_files = relationship("AudioFile", back_populates="classroom")
