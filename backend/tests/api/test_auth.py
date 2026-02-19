from tests.conftest import _create_user, _auth_cookies


class TestGetMe:
    def test_returns_user_data(self, auth_client, auth_user):
        response = auth_client.get("/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == auth_user.id
        assert data["email"] == auth_user.email
        assert data["name"] == auth_user.name
        assert data["role"] == auth_user.role
        assert "organization" in data
        assert "group" in data

    def test_returns_instructor_role(self, instructor_client, instructor_user):
        response = instructor_client.get("/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "instructor"
        assert data["name"] == "Prof Smith"

    def test_unauthenticated_returns_401(self, client):
        response = client.get("/auth/me")

        assert response.status_code == 401


class TestUpdateName:
    def test_updates_name(self, auth_client, auth_user):
        response = auth_client.patch("/auth/me/name", json={"name": "New Name"})

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert data["message"] == "Name updated successfully"

    def test_empty_name_returns_422(self, auth_client):
        response = auth_client.patch("/auth/me/name", json={"name": ""})

        assert response.status_code == 422

    def test_whitespace_only_name_returns_422(self, auth_client):
        response = auth_client.patch("/auth/me/name", json={"name": "   "})

        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, client):
        response = client.patch("/auth/me/name", json={"name": "New Name"})

        assert response.status_code == 401


class TestUpdateRole:
    def test_set_to_student(self, auth_client):
        response = auth_client.patch("/auth/me/role", json={"role": "student"})

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "student"

    def test_set_to_instructor(self, auth_client):
        response = auth_client.patch("/auth/me/role", json={"role": "instructor"})

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "instructor"

    def test_invalid_role_returns_422(self, auth_client):
        response = auth_client.patch("/auth/me/role", json={"role": "admin"})

        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, client):
        response = client.patch("/auth/me/role", json={"role": "student"})

        assert response.status_code == 401


class TestLogout:
    def test_clears_cookies(self, auth_client):
        response = auth_client.post("/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Logged out successfully"

    def test_unauthenticated_still_succeeds(self, client):
        response = client.post("/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Logged out successfully"
