import uuid
from datetime import datetime

import pytest

from app.models import User, Rubric, RubricCriterion, RubricType
from app.dao.rubric_dao import rubric_dao


def _make_user(db) -> User:
    user = User(
        id=str(uuid.uuid4()),
        identity_provider_id=str(uuid.uuid4()),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        name="Test",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    return user


def _make_rubric(db, user_id=None, rubric_type=RubricType.custom) -> Rubric:
    rubric_id = str(uuid.uuid4())
    rubric = Rubric(
        id=rubric_id,
        user_id=user_id,
        name="Test Rubric",
        description="Test",
        rubric_type=rubric_type,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    criterion = RubricCriterion(
        id=str(uuid.uuid4()),
        rubric_id=rubric_id,
        name="Quality",
        description="Quality of work",
        max_score=5,
        weight=1.0,
        order_index=0,
        created_at=datetime.utcnow(),
    )
    db.add(rubric)
    db.add(criterion)
    db.commit()
    db.refresh(rubric)
    return rubric


class TestRubricDAO:
    def test_list_accessible_returns_builtin(self, db):
        _make_rubric(db, user_id=None, rubric_type=RubricType.built_in)
        rubrics = rubric_dao.list_accessible(db, "some-user-id")
        assert len(rubrics) == 1
        assert rubrics[0].rubric_type == RubricType.built_in

    def test_list_accessible_returns_own_custom(self, db):
        user = _make_user(db)
        _make_rubric(db, user_id=user.id, rubric_type=RubricType.custom)
        rubrics = rubric_dao.list_accessible(db, user.id)
        assert len(rubrics) == 1

    def test_list_accessible_excludes_others_custom(self, db):
        user1 = _make_user(db)
        user2 = _make_user(db)
        _make_rubric(db, user_id=user1.id, rubric_type=RubricType.custom)
        rubrics = rubric_dao.list_accessible(db, user2.id)
        assert len(rubrics) == 0

    def test_get_by_id(self, db):
        rubric = _make_rubric(db, rubric_type=RubricType.built_in)
        found = rubric_dao.get_by_id(db, rubric.id)
        assert found is not None
        assert found.name == "Test Rubric"

    def test_create(self, db):
        user = _make_user(db)
        rubric_id = str(uuid.uuid4())
        rubric = Rubric(
            id=rubric_id, user_id=user.id, name="New",
            rubric_type=RubricType.custom,
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        criteria = [RubricCriterion(
            id=str(uuid.uuid4()), rubric_id=rubric_id, name="C1",
            description="D", max_score=5, weight=1.0, order_index=0,
            created_at=datetime.utcnow(),
        )]
        result = rubric_dao.create(db, rubric, criteria)
        assert result.id == rubric_id
        assert len(result.criteria) == 1

    def test_delete(self, db):
        rubric = _make_rubric(db, rubric_type=RubricType.built_in)
        rubric_dao.delete(db, rubric)
        assert rubric_dao.get_by_id(db, rubric.id) is None

    def test_get_criteria_by_rubric(self, db):
        rubric = _make_rubric(db, rubric_type=RubricType.built_in)
        criteria = rubric_dao.get_criteria_by_rubric(db, rubric.id)
        assert len(criteria) == 1
        assert criteria[0].name == "Quality"
