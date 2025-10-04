import pytest

from app.models import CardSubmission


@pytest.mark.unit
class TestAdminCardRoutes:
    def test_admin_get_cards(self, client, admin_token, sample_card):
        """Test admin getting all cards"""
        response = client.get(
            "/api/admin/cards", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        data = response.json
        assert "cards" in data
        assert data["total"] >= 1

    def test_admin_get_cards_unauthorized(self, client, user_token):
        """Test non-admin cannot access admin cards"""
        response = client.get("/api/admin/cards", headers={"Authorization": f"Bearer {user_token}"})

        assert response.status_code == 403

    def test_admin_create_card(self, client, admin_token):
        """Test admin creating card"""
        response = client.post(
            "/api/admin/cards",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Admin Created Business",
                "description": "Created by admin",
                "tags": ["new-tag"],
            },
        )

        assert response.status_code == 201
        assert response.json["name"] == "Admin Created Business"
        assert response.json["approved"] is True

    def test_admin_update_card(self, client, admin_token, sample_card):
        """Test admin updating card"""
        response = client.put(
            f"/api/admin/cards/{sample_card.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "Updated Business Name", "featured": False},
        )

        assert response.status_code == 200
        assert response.json["name"] == "Updated Business Name"
        assert response.json["featured"] is False

    def test_admin_delete_card(self, client, admin_token, sample_card):
        """Test admin deleting card"""
        response = client.delete(
            f"/api/admin/cards/{sample_card.id}", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        assert "deleted" in response.json["message"]


@pytest.mark.unit
class TestAdminSubmissionRoutes:
    def test_admin_get_submissions(self, client, admin_token, db_session, regular_user):
        """Test admin getting submissions"""
        submission = CardSubmission(
            name="Pending Submission", submitted_by=regular_user.id, status="pending"
        )
        db_session.session.add(submission)
        db_session.session.commit()

        response = client.get(
            "/api/admin/submissions", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        data = response.json
        assert data["total"] >= 1

    def test_admin_approve_submission(self, client, admin_token, db_session, regular_user):
        """Test admin approving submission"""
        submission = CardSubmission(
            name="Pending Business",
            description="Pending description",
            tags_text="tag1,tag2",
            submitted_by=regular_user.id,
            status="pending",
        )
        db_session.session.add(submission)
        db_session.session.commit()

        response = client.post(
            f"/api/admin/submissions/{submission.id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"notes": "Approved"},
        )

        assert response.status_code == 200
        data = response.json
        assert data["message"] == "Submission approved"
        assert "card" in data

    def test_admin_reject_submission(self, client, admin_token, db_session, regular_user):
        """Test admin rejecting submission"""
        submission = CardSubmission(
            name="Bad Submission", submitted_by=regular_user.id, status="pending"
        )
        db_session.session.add(submission)
        db_session.session.commit()

        response = client.post(
            f"/api/admin/submissions/{submission.id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"notes": "Rejected for reasons"},
        )

        assert response.status_code == 200
        assert "rejected" in response.json["message"]


@pytest.mark.unit
class TestAdminUserRoutes:
    def test_admin_get_users(self, client, admin_token, regular_user):
        """Test admin getting users"""
        response = client.get(
            "/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        data = response.json
        assert data["total"] >= 1

    def test_admin_update_user(self, client, admin_token, regular_user):
        """Test admin updating user"""
        response = client.put(
            f"/api/admin/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"first_name": "Updated", "role": "admin"},
        )

        assert response.status_code == 200
        assert response.json["first_name"] == "Updated"
        assert response.json["role"] == "admin"

    def test_admin_cannot_demote_self(self, client, admin_token, admin_user):
        """Test admin cannot demote themselves"""
        response = client.put(
            f"/api/admin/users/{admin_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "user"},
        )

        assert response.status_code == 400
        assert "Cannot demote yourself" in response.json["message"]

    def test_admin_delete_user(self, client, admin_token, db_session):
        """Test admin deleting user with no content"""
        from app.models import User

        user = User(email="deleteme@test.com", first_name="Delete", last_name="Me", role="user")
        user.set_password("DeletePass123")
        db_session.session.add(user)
        db_session.session.commit()

        response = client.delete(
            f"/api/admin/users/{user.id}", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        assert "deleted" in response.json["message"]


@pytest.mark.unit
class TestAdminTagRoutes:
    def test_admin_get_tags(self, client, admin_token, sample_tag):
        """Test admin getting tags"""
        response = client.get("/api/admin/tags", headers={"Authorization": f"Bearer {admin_token}"})

        assert response.status_code == 200
        tags = response.json
        assert len(tags) >= 1

    def test_admin_create_tag(self, client, admin_token):
        """Test admin creating tag"""
        response = client.post(
            "/api/admin/tags",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "new-admin-tag"},
        )

        assert response.status_code == 201
        assert response.json["name"] == "new-admin-tag"

    def test_admin_update_tag(self, client, admin_token, sample_tag):
        """Test admin updating tag"""
        response = client.put(
            f"/api/admin/tags/{sample_tag.name}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "updated-tag"},
        )

        assert response.status_code == 200
        assert response.json["name"] == "updated-tag"

    def test_admin_delete_tag(self, client, admin_token, sample_tag):
        """Test admin deleting tag"""
        response = client.delete(
            f"/api/admin/tags/{sample_tag.name}", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        assert "deleted" in response.json["message"]


@pytest.mark.unit
class TestAdminResourceRoutes:
    def test_admin_get_resource_configs(self, client, admin_token, sample_resource_config):
        """Test admin getting resource configs"""
        response = client.get(
            "/api/admin/resources/config", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        configs = response.json
        assert len(configs) >= 1

    def test_admin_create_resource_config(self, client, admin_token):
        """Test admin creating resource config"""
        response = client.post(
            "/api/admin/resources/config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"key": "new_config", "value": "config_value", "description": "Test config"},
        )

        assert response.status_code == 201
        assert response.json["config"]["key"] == "new_config"

    def test_admin_update_resource_config(self, client, admin_token, sample_resource_config):
        """Test admin updating resource config"""
        response = client.put(
            f"/api/admin/resources/config/{sample_resource_config.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"value": "Updated Value"},
        )

        assert response.status_code == 200
        assert response.json["config"]["value"] == "Updated Value"

    def test_admin_get_quick_access_items(self, client, admin_token, sample_quick_access):
        """Test admin getting quick access items"""
        response = client.get(
            "/api/admin/resources/quick-access", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        items = response.json
        assert len(items) >= 1

    def test_admin_create_quick_access_item(self, client, admin_token):
        """Test admin creating quick access item"""
        response = client.post(
            "/api/admin/resources/quick-access",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "identifier": "new-item",
                "title": "New Item",
                "subtitle": "Subtitle",
                "phone": "555-0000",
                "color": "blue",
                "icon": "star",
            },
        )

        assert response.status_code == 201

    def test_admin_get_resource_items(self, client, admin_token, sample_resource_item):
        """Test admin getting resource items"""
        response = client.get(
            "/api/admin/resources/items", headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        items = response.json
        assert len(items) >= 1

    def test_admin_create_resource_item(self, client, admin_token):
        """Test admin creating resource item"""
        response = client.post(
            "/api/admin/resources/items",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "New Resource",
                "url": "https://new.com",
                "description": "New description",
                "category": "Test",
                "icon": "building",
            },
        )

        assert response.status_code == 201
