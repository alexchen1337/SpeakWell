from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import AudioStatus


class AudioFile(Base):
    __tablename__ = "audio_files"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    object_key = Column(String(1024), nullable=False)
    media_type = Column(String(16), nullable=True)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(AudioStatus), nullable=False, default=AudioStatus.uploaded)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="audio_files")
    transcript = relationship("Transcript", back_populates="audio_file", uselist=False, cascade="all, delete-orphan")
    classroom = relationship("Classroom", back_populates="audio_files")
