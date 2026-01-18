from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path
import enum

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable must be set")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AudioStatus(enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"


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


class AudioFile(Base):
    __tablename__ = "audio_files"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    object_key = Column(String(1024), nullable=False)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)
    status = Column(SQLEnum(AudioStatus), nullable=False, default=AudioStatus.uploaded)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="audio_files")
    transcript = relationship("Transcript", back_populates="audio_file", uselist=False, cascade="all, delete-orphan")


class Transcript(Base):
    __tablename__ = "transcripts"
    
    id = Column(String(36), primary_key=True)
    audio_file_id = Column(String(36), ForeignKey("audio_files.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    text = Column(Text, nullable=False)
    # {"words": [{"word": "hello", "start": 0.0, "end": 0.5}, ...]}
    word_timestamps = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    
    audio_file = relationship("AudioFile", back_populates="transcript")


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token = Column(String(512), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())
    
    user = relationship("User", back_populates="sessions")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()

