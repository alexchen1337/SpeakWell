import uuid
from datetime import datetime

import pytest

from app.models import User
from app.dao.user_dao import user_dao


def _make_user(db, email=None) -> User:
    user = User(
        id=str(uuid.uuid4()),
        identity_provider_id=str(uuid.uuid4()),
        email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
        name="Test User",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestUserDAO:
    def test_get_by_id(self, db):
        user = _make_user(db)
        found = user_dao.get_by_id(db, user.id)
        assert found is not None
        assert found.id == user.id

    def test_get_by_id_not_found(self, db):
        found = user_dao.get_by_id(db, "nonexistent-id")
        assert found is None

    def test_get_by_email(self, db):
        user = _make_user(db, email="findme@example.com")
        found = user_dao.get_by_email(db, "findme@example.com")
        assert found is not None
        assert found.email == "findme@example.com"

    def test_get_by_identity_provider_id(self, db):
        user = _make_user(db)
        found = user_dao.get_by_identity_provider_id(db, user.identity_provider_id)
        assert found is not None
        assert found.id == user.id

    def test_update_name(self, db):
        user = _make_user(db)
        user_dao.update_name(db, user, "New Name")
        assert user.name == "New Name"

    def test_update_role(self, db):
        user = _make_user(db)
        user_dao.update_role(db, user, "instructor")
        assert user.role == "instructor"

    def test_get_by_ids(self, db):
        u1 = _make_user(db)
        u2 = _make_user(db)
        users = user_dao.get_by_ids(db, [u1.id, u2.id])
        assert len(users) == 2

    def test_get_by_ids_empty(self, db):
        users = user_dao.get_by_ids(db, [])
        assert users == []
