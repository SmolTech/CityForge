import pytest


@pytest.mark.unit
class TestResourceRoutes:
    def test_get_resources_config(self, client, sample_resource_config):
        """Test getting resources configuration"""
        response = client.get("/api/resources/config")

        assert response.status_code == 200
        data = response.json
        assert "site" in data
        assert data["site"]["title"] == "Test Site"

    def test_get_quick_access(self, client, sample_quick_access):
        """Test getting quick access items"""
        response = client.get("/api/resources/quick-access")

        assert response.status_code == 200
        items = response.json
        assert len(items) >= 1
        assert items[0]["id"] == "emergency"
        assert items[0]["phone"] == "911"

    def test_get_resource_items(self, client, sample_resource_item):
        """Test getting resource items"""
        response = client.get("/api/resources/items")

        assert response.status_code == 200
        items = response.json
        assert len(items) >= 1
        assert items[0]["title"] == "Test Resource"

    def test_get_resource_items_by_category(self, client, sample_resource_item):
        """Test filtering resource items by category"""
        response = client.get("/api/resources/items?category=Government")

        assert response.status_code == 200
        items = response.json
        assert all(item["category"] == "Government" for item in items)

    def test_get_resource_categories(self, client, sample_resource_item):
        """Test getting resource categories"""
        response = client.get("/api/resources/categories")

        assert response.status_code == 200
        categories = response.json
        assert "Government" in categories

    def test_get_site_config(self, client, sample_resource_config):
        """Test getting site configuration"""
        response = client.get("/api/site-config")

        assert response.status_code == 200
        data = response.json
        assert "site" in data
        assert data["site"]["title"] == "Test Site"

    def test_get_complete_resources(
        self, client, sample_resource_config, sample_quick_access, sample_resource_item
    ):
        """Test getting complete resources data"""
        response = client.get("/api/resources")

        assert response.status_code == 200
        data = response.json
        assert "site" in data
        assert "quickAccess" in data
        assert "resources" in data
        assert "footer" in data
        assert len(data["quickAccess"]) >= 1
        assert len(data["resources"]) >= 1
