import uuid
from datetime import datetime

from app.models import Classroom, Enrollment
from tests.conftest import _create_user, _auth_cookies


class TestCreateClass:
    def test_instructor_creates_class(self, instructor_client):
        response = instructor_client.post("/api/classes", json={
            "name": "CS 101",
            "description": "Intro to CS",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "CS 101"
        assert data["description"] == "Intro to CS"
        assert len(data["joinCode"]) == 8
        assert data["studentCount"] == 0

    def test_student_cant_create_class(self, student_client):
        response = student_client.post("/api/classes", json={
            "name": "My Class",
        })
        assert response.status_code == 403


class TestJoinClass:
    def test_student_joins_class(self, student_client, sample_classroom):
        response = student_client.post("/api/classes/join", json={
            "join_code": sample_classroom.join_code,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Class"
        assert data["studentCount"] == 1

    def test_cant_join_twice(self, student_client, student_user, db, sample_classroom):
        enrollment = Enrollment(
            id=str(uuid.uuid4()),
            class_id=sample_classroom.id,
            student_id=student_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(enrollment)
        db.commit()

        response = student_client.post("/api/classes/join", json={
            "join_code": sample_classroom.join_code,
        })
        assert response.status_code == 400
        assert "Already enrolled" in response.json()["detail"]

    def test_invalid_join_code(self, student_client):
        response = student_client.post("/api/classes/join", json={
            "join_code": "BADCODE1",
        })
        assert response.status_code == 404


class TestListClasses:
    def test_list_teaching(self, instructor_client, sample_classroom):
        response = instructor_client.get("/api/classes/teaching")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Class"

    def test_list_enrolled(self, student_client, student_user, db, sample_classroom):
        enrollment = Enrollment(
            id=str(uuid.uuid4()),
            class_id=sample_classroom.id,
            student_id=student_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(enrollment)
        db.commit()

        response = student_client.get("/api/classes/enrolled")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Class"


class TestGetClass:
    def test_instructor_gets_class(self, instructor_client, sample_classroom):
        response = instructor_client.get(f"/api/classes/{sample_classroom.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Class"

    def test_enrolled_student_gets_class(self, student_client, student_user, db, sample_classroom):
        enrollment = Enrollment(
            id=str(uuid.uuid4()),
            class_id=sample_classroom.id,
            student_id=student_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(enrollment)
        db.commit()

        response = student_client.get(f"/api/classes/{sample_classroom.id}")
        assert response.status_code == 200

    def test_unenrolled_student_denied(self, student_client, sample_classroom):
        response = student_client.get(f"/api/classes/{sample_classroom.id}")
        assert response.status_code == 403


class TestDeleteClass:
    def test_instructor_deletes_class(self, instructor_client, sample_classroom):
        response = instructor_client.delete(f"/api/classes/{sample_classroom.id}")
        assert response.status_code == 204

    def test_student_cant_delete_class(self, student_client, sample_classroom):
        response = student_client.delete(f"/api/classes/{sample_classroom.id}")
        assert response.status_code == 403

    def test_other_instructor_cant_delete(self, db, client, sample_classroom):
        other = _create_user(db, role="instructor", email="other@test.com")
        client.cookies.update(_auth_cookies(other))
        response = client.delete(f"/api/classes/{sample_classroom.id}")
        assert response.status_code == 403
