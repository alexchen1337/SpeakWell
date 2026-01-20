from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    Text,
    JSON,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path
import enum
import secrets
import string

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable must be set")

# Convert postgresql:// to postgresql+psycopg:// for psycopg3 compatibility
if DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

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


class RubricType(enum.Enum):
    built_in = "built_in"
    custom = "custom"


class GradingStatus(enum.Enum):
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


class AudioFile(Base):
    __tablename__ = "audio_files"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    object_key = Column(String(1024), nullable=False)
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


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(String(36), primary_key=True)
    class_id = Column(
        String(36),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, nullable=False, default=func.now())

    __table_args__ = (
        UniqueConstraint("class_id", "student_id", name="uq_enrollments_class_student"),
    )

    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")


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
    gradings = relationship("Grading", back_populates="transcript", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token = Column(String(512), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())

    user = relationship("User", back_populates="sessions")


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
    max_score = Column(Integer, nullable=False)
    weight = Column(Float, nullable=False)
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())

    rubric = relationship("Rubric", back_populates="criteria")


class Grading(Base):
    __tablename__ = "gradings"

    id = Column(String(36), primary_key=True)
    transcript_id = Column(String(36), ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    rubric_id = Column(String(36), ForeignKey("rubrics.id", ondelete="SET NULL"), nullable=True, index=True)
    graded_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(GradingStatus), nullable=False, default=GradingStatus.processing)
    overall_score = Column(Float, nullable=True)
    max_possible_score = Column(Float, nullable=True)

    # Pacing metrics
    pacing_wpm_avg = Column(Float, nullable=True)
    pacing_wpm_variance = Column(Float, nullable=True)
    pacing_pause_count = Column(Integer, nullable=True)
    pacing_score = Column(Float, nullable=True)

    # Clarity metrics
    clarity_filler_word_count = Column(Integer, nullable=True)
    clarity_filler_word_percentage = Column(Float, nullable=True)
    clarity_nonsensical_word_count = Column(Integer, nullable=True)
    clarity_score = Column(Float, nullable=True)

    # Detailed results as JSON
    detailed_results = Column(JSON, nullable=True)

    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    transcript = relationship("Transcript", back_populates="gradings")
    rubric = relationship("Rubric", back_populates="gradings")
    graded_by = relationship("User", foreign_keys=[graded_by_user_id])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_abet_rubric():
    """Seed the built-in ABET rubric if it doesn't exist."""
    import uuid

    db = SessionLocal()
    try:
        # Check if ABET rubric already exists
        existing = db.query(Rubric).filter(
            Rubric.rubric_type == RubricType.built_in,
            Rubric.name == "ABET Presentation Rubric"
        ).first()

        if existing:
            return

        # Create ABET rubric
        rubric_id = str(uuid.uuid4())
        abet_rubric = Rubric(
            id=rubric_id,
            user_id=None,
            name="ABET Presentation Rubric",
            description="Standard ABET rubric for evaluating technical presentations",
            rubric_type=RubricType.built_in
        )

        # Create criteria
        criteria = [
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name="Technical Content",
                description="Demonstrates depth of technical knowledge, accuracy of information, and appropriate use of terminology",
                max_score=5,
                weight=3.0,
                order_index=0
            ),
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name="Organization & Structure",
                description="Clear introduction, logical flow of ideas, smooth transitions, and effective conclusion",
                max_score=5,
                weight=2.0,
                order_index=1
            ),
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name="Communication Clarity",
                description="Clear articulation, appropriate volume and pace, minimal filler words, professional language",
                max_score=5,
                weight=2.0,
                order_index=2
            ),
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name="Evidence & Support",
                description="Uses relevant examples, data, and citations to support claims and arguments",
                max_score=5,
                weight=2.0,
                order_index=3
            ),
            RubricCriterion(
                id=str(uuid.uuid4()),
                rubric_id=rubric_id,
                name="Audience Engagement",
                description="Maintains audience interest, addresses audience needs, and demonstrates awareness of audience level",
                max_score=5,
                weight=1.0,
                order_index=4
            )
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


def generate_join_code(length: int = 8) -> str:
    """Generate a unique, human-friendly join code for classrooms."""
    # Use uppercase letters and digits, excluding confusing chars like 0/O, 1/I/L
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def init_db():
    Base.metadata.create_all(bind=engine)
    seed_abet_rubric()


if __name__ == "__main__":
    init_db()

