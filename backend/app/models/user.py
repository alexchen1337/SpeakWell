from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    identity_provider_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    role = Column(String(50), nullable=True)
    organization = Column(String(255), nullable=True)
    group = Column(String(255), nullable=True)

    audio_files = relationship("AudioFile", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    rubrics = relationship("Rubric", back_populates="user", cascade="all, delete-orphan")
    classes_taught = relationship(
        "Classroom",
        back_populates="instructor",
        cascade="all, delete-orphan",
        foreign_keys="Classroom.instructor_id",
    )
    enrollments = relationship(
        "Enrollment",
        back_populates="student",
        cascade="all, delete-orphan",
    )
