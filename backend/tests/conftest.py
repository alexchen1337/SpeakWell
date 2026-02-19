import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models import (
    User, AudioFile, AudioStatus, Transcript, Classroom, Enrollment,
    Rubric, RubricType, RubricCriterion, Grading, GradingStatus, Session as DBSession,
)
from app.core.dependencies import get_db, get_current_user
from app.core.security import create_access_token, hash_refresh_token
from app.main import app


SQLALCHEMY_TEST_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Disable startup event so it doesn't try to connect to production DB
    original_handlers = app.router.on_startup.copy()
    app.router.on_startup.clear()

    with TestClient(app) as c:
        yield c

    app.router.on_startup = original_handlers
    app.dependency_overrides.clear()


def _create_user(db, role=None, email=None, name=None) -> User:
    user = User(
        id=str(uuid.uuid4()),
        identity_provider_id=str(uuid.uuid4()),
        email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
        name=name or "Test User",
        role=role,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_cookies(user: User) -> dict:
    token = create_access_token({"user_id": user.id, "email": user.email})
    return {"access_token": token}


@pytest.fixture
def auth_user(db):
    return _create_user(db)


@pytest.fixture
def instructor_user(db):
    return _create_user(db, role="instructor", name="Prof Smith")


@pytest.fixture
def student_user(db):
    return _create_user(db, role="student", name="Alice Student")


@pytest.fixture
def auth_client(client, auth_user):
    client.cookies.update(_auth_cookies(auth_user))
    return client


@pytest.fixture
def instructor_client(client, instructor_user):
    client.cookies.update(_auth_cookies(instructor_user))
    return client


@pytest.fixture
def student_client(client, student_user):
    client.cookies.update(_auth_cookies(student_user))
    return client


@pytest.fixture
def sample_rubric(db, instructor_user):
    rubric_id = str(uuid.uuid4())
    rubric = Rubric(
        id=rubric_id,
        user_id=None,
        name="Test Rubric",
        description="A test rubric",
        rubric_type=RubricType.built_in,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    criteria = [
        RubricCriterion(
            id=str(uuid.uuid4()),
            rubric_id=rubric_id,
            name="Content",
            description="Content quality",
            max_score=5,
            weight=2.0,
            order_index=0,
            created_at=datetime.utcnow(),
        ),
        RubricCriterion(
            id=str(uuid.uuid4()),
            rubric_id=rubric_id,
            name="Delivery",
            description="Delivery quality",
            max_score=5,
            weight=1.0,
            order_index=1,
            created_at=datetime.utcnow(),
        ),
    ]
    db.add(rubric)
    db.add_all(criteria)
    db.commit()
    db.refresh(rubric)
    return rubric


@pytest.fixture
def sample_audio(db, student_user):
    audio = AudioFile(
        id=str(uuid.uuid4()),
        user_id=student_user.id,
        object_key=f"{student_user.id}/test.mp3",
        filename="test.mp3",
        file_size=1024,
        duration=60,
        status=AudioStatus.completed,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(audio)
    db.commit()
    db.refresh(audio)
    return audio


@pytest.fixture
def sample_transcript(db, sample_audio):
    transcript = Transcript(
        id=str(uuid.uuid4()),
        audio_file_id=sample_audio.id,
        text="This is a test transcript for grading.",
        word_timestamps={"words": [
            {"word": "This", "start": 0.0, "end": 0.3},
            {"word": "is", "start": 0.4, "end": 0.5},
            {"word": "a", "start": 0.6, "end": 0.7},
            {"word": "test", "start": 0.8, "end": 1.0},
        ]},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


@pytest.fixture
def sample_classroom(db, instructor_user):
    classroom = Classroom(
        id=str(uuid.uuid4()),
        instructor_id=instructor_user.id,
        name="Test Class",
        description="A test class",
        join_code="TESTCODE",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom
