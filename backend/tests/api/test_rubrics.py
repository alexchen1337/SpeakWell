import uuid
from datetime import datetime

from app.models import Rubric, RubricCriterion, RubricType
from tests.conftest import _create_user, _auth_cookies


class TestListRubrics:
    def test_returns_builtin_rubric(self, auth_client, db, sample_rubric):
        response = auth_client.get("/api/rubrics")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(r["name"] == "Test Rubric" for r in data)

    def test_unauthenticated_returns_401(self, client):
        response = client.get("/api/rubrics")
        assert response.status_code == 401


class TestCreateRubric:
    def test_creates_custom_rubric(self, auth_client):
        response = auth_client.post("/api/rubrics", json={
            "name": "My Rubric",
            "description": "Custom rubric",
            "criteria": [
                {"name": "C1", "description": "Criterion 1", "max_score": 5, "weight": 2.0},
                {"name": "C2", "description": "Criterion 2", "max_score": 10, "weight": 1.0},
            ],
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Rubric"
        assert data["rubricType"] == "custom"
        assert len(data["criteria"]) == 2
        assert data["criteria"][0]["maxScore"] == 5
        assert data["criteria"][1]["weight"] == 1.0

    def test_requires_at_least_one_criterion(self, auth_client):
        response = auth_client.post("/api/rubrics", json={
            "name": "Empty Rubric",
            "criteria": [],
        })
        assert response.status_code == 422


class TestGetRubric:
    def test_get_builtin_rubric(self, auth_client, sample_rubric):
        response = auth_client.get(f"/api/rubrics/{sample_rubric.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Rubric"
        assert len(data["criteria"]) == 2

    def test_get_nonexistent_rubric(self, auth_client):
        response = auth_client.get(f"/api/rubrics/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_cant_access_others_custom_rubric(self, db, client):
        user1 = _create_user(db, email="owner@test.com")
        user2 = _create_user(db, email="other@test.com")

        rubric_id = str(uuid.uuid4())
        rubric = Rubric(
            id=rubric_id, user_id=user1.id, name="Private",
            rubric_type=RubricType.custom,
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(rubric)
        db.add(RubricCriterion(
            id=str(uuid.uuid4()), rubric_id=rubric_id, name="C",
            description="D", max_score=5, weight=1.0, order_index=0,
            created_at=datetime.utcnow(),
        ))
        db.commit()

        client.cookies.update(_auth_cookies(user2))
        response = client.get(f"/api/rubrics/{rubric_id}")
        assert response.status_code == 403


class TestDeleteRubric:
    def test_cant_delete_builtin(self, auth_client, sample_rubric):
        response = auth_client.delete(f"/api/rubrics/{sample_rubric.id}")
        assert response.status_code == 403

    def test_delete_own_custom_rubric(self, auth_client, auth_user, db):
        rubric_id = str(uuid.uuid4())
        rubric = Rubric(
            id=rubric_id, user_id=auth_user.id, name="ToDelete",
            rubric_type=RubricType.custom,
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(rubric)
        db.add(RubricCriterion(
            id=str(uuid.uuid4()), rubric_id=rubric_id, name="C",
            description="D", max_score=5, weight=1.0, order_index=0,
            created_at=datetime.utcnow(),
        ))
        db.commit()

        response = auth_client.delete(f"/api/rubrics/{rubric_id}")
        assert response.status_code == 204
