import pytest


@pytest.mark.unit
class TestAuthRoutes:
    def test_register_success(self, client, db_session):
        """Test successful user registration"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@test.com",
                "password": "NewPass123",
                "first_name": "New",
                "last_name": "User",
            },
        )

        assert response.status_code == 201
        data = response.json
        assert "access_token" in data
        assert data["user"]["email"] == "newuser@test.com"
        assert data["user"]["role"] == "user"

    def test_register_duplicate_email(self, client, regular_user):
        """Test registration with duplicate email"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "user@test.com",
                "password": "NewPass123",
                "first_name": "New",
                "last_name": "User",
            },
        )

        assert response.status_code == 400
        assert "already registered" in response.json["message"]

    def test_register_weak_password(self, client, db_session):
        """Test registration with weak password"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@test.com",
                "password": "weak",
                "first_name": "New",
                "last_name": "User",
            },
        )

        assert response.status_code == 400
        assert "characters" in response.json["message"]

    def test_register_missing_fields(self, client, db_session):
        """Test registration with missing fields"""
        response = client.post(
            "/api/auth/register", json={"email": "newuser@test.com", "password": "NewPass123"}
        )

        assert response.status_code == 400
        assert "Missing required fields" in response.json["message"]

    def test_login_success(self, client, regular_user):
        """Test successful login"""
        response = client.post(
            "/api/auth/login", json={"email": "user@test.com", "password": "UserPass123"}
        )

        assert response.status_code == 200
        data = response.json
        assert "access_token" in data
        assert data["user"]["email"] == "user@test.com"

    def test_login_invalid_credentials(self, client, regular_user):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/auth/login", json={"email": "user@test.com", "password": "WrongPassword"}
        )

        assert response.status_code == 401
        assert "Invalid credentials" in response.json["message"]

    def test_login_missing_fields(self, client):
        """Test login with missing fields"""
        response = client.post("/api/auth/login", json={"email": "user@test.com"})

        assert response.status_code == 400
        assert "Missing email or password" in response.json["message"]

    def test_logout(self, client, user_token):
        """Test logout"""
        response = client.post(
            "/api/auth/logout", headers={"Authorization": f"Bearer {user_token}"}
        )

        assert response.status_code == 200
        assert "logged out" in response.json["message"]

    def test_get_current_user(self, client, user_token, regular_user):
        """Test getting current user"""
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})

        assert response.status_code == 200
        assert response.json["user"]["email"] == "user@test.com"

    def test_get_current_user_unauthorized(self, client):
        """Test getting current user without token"""
        response = client.get("/api/auth/me")

        assert response.status_code == 401

    def test_update_email_success(self, client, user_token, db_session):
        """Test updating email"""
        response = client.put(
            "/api/auth/update-email",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"email": "newemail@test.com", "current_password": "UserPass123"},
        )

        assert response.status_code == 200
        assert response.json["user"]["email"] == "newemail@test.com"

    def test_update_email_wrong_password(self, client, user_token):
        """Test updating email with wrong password"""
        response = client.put(
            "/api/auth/update-email",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"email": "newemail@test.com", "current_password": "WrongPassword"},
        )

        assert response.status_code == 401

    def test_update_password_success(self, client, user_token):
        """Test updating password"""
        response = client.put(
            "/api/auth/update-password",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"current_password": "UserPass123", "new_password": "NewPass456"},
        )

        assert response.status_code == 200
        assert "Password updated" in response.json["message"]

    def test_update_password_weak(self, client, user_token):
        """Test updating to weak password"""
        response = client.put(
            "/api/auth/update-password",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"current_password": "UserPass123", "new_password": "weak"},
        )

        assert response.status_code == 400

    def test_update_profile_success(self, client, user_token):
        """Test updating profile"""
        response = client.put(
            "/api/auth/update-profile",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"first_name": "Updated", "last_name": "Name"},
        )

        assert response.status_code == 200
        assert response.json["user"]["first_name"] == "Updated"
        assert response.json["user"]["last_name"] == "Name"
