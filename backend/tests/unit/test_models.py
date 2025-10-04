import pytest
from app.models import User, Card, Tag, ResourceConfig, QuickAccessItem, ResourceItem


@pytest.mark.unit
class TestUserModel:
    def test_user_creation(self, db_session):
        """Test user creation"""
        user = User(email="test@example.com", first_name="Test", last_name="User", role="user")
        user.set_password("TestPass123")
        db_session.session.add(user)
        db_session.session.commit()

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.first_name == "Test"
        assert user.role == "user"

    def test_password_hashing(self, db_session):
        """Test password hashing"""
        user = User(email="test@example.com", first_name="Test", last_name="User")
        user.set_password("TestPass123")

        assert user.password_hash != "TestPass123"
        assert user.check_password("TestPass123")
        assert not user.check_password("WrongPassword")

    def test_password_validation_length(self, db_session):
        """Test password length validation"""
        user = User(email="test@example.com", first_name="Test", last_name="User")

        with pytest.raises(ValueError, match="at least 8 characters"):
            user.set_password("Short1")

    def test_password_validation_lowercase(self, db_session):
        """Test password requires lowercase"""
        user = User(email="test@example.com", first_name="Test", last_name="User")

        with pytest.raises(ValueError, match="lowercase letter"):
            user.set_password("NOLOWERCASE123")

    def test_password_validation_uppercase(self, db_session):
        """Test password requires uppercase"""
        user = User(email="test@example.com", first_name="Test", last_name="User")

        with pytest.raises(ValueError, match="uppercase letter"):
            user.set_password("nouppercase123")

    def test_password_validation_number(self, db_session):
        """Test password requires number"""
        user = User(email="test@example.com", first_name="Test", last_name="User")

        with pytest.raises(ValueError, match="number"):
            user.set_password("NoNumbers")

    def test_user_to_dict(self, admin_user):
        """Test user serialization"""
        user_dict = admin_user.to_dict()

        assert user_dict["email"] == "admin@test.com"
        assert user_dict["first_name"] == "Admin"
        assert user_dict["role"] == "admin"
        assert "password_hash" not in user_dict


@pytest.mark.unit
class TestCardModel:
    def test_card_creation(self, db_session, admin_user):
        """Test card creation"""
        card = Card(
            name="Test Business",
            description="Test description",
            approved=True,
            created_by=admin_user.id,
        )
        db_session.session.add(card)
        db_session.session.commit()

        assert card.id is not None
        assert card.name == "Test Business"
        assert card.approved is True

    def test_card_slug_generation(self, sample_card):
        """Test slug generation"""
        assert sample_card.slug == "test-business"

        card2 = Card(name="Test & Special! Characters")
        assert card2.slug == "test-special-characters"

    def test_card_share_url(self, sample_card):
        """Test share URL generation"""
        assert sample_card.share_url == f"/business/{sample_card.id}/test-business"

    def test_card_with_tags(self, db_session, sample_card, sample_tag):
        """Test card with tags"""
        assert len(sample_card.tags) == 1
        assert sample_card.tags[0].name == "test-tag"

    def test_card_to_dict(self, sample_card):
        """Test card serialization"""
        card_dict = sample_card.to_dict()

        assert card_dict["name"] == "Test Business"
        assert card_dict["description"] == "Test description"
        assert card_dict["approved"] is True
        assert "test-tag" in card_dict["tags"]

    def test_card_to_dict_with_share_url(self, sample_card):
        """Test card serialization with share URL"""
        card_dict = sample_card.to_dict(include_share_url=True)

        assert "slug" in card_dict
        assert "share_url" in card_dict
        assert card_dict["slug"] == "test-business"


@pytest.mark.unit
class TestTagModel:
    def test_tag_creation(self, db_session):
        """Test tag creation"""
        tag = Tag(name="test-category")
        db_session.session.add(tag)
        db_session.session.commit()

        assert tag.id is not None
        assert tag.name == "test-category"

    def test_tag_to_dict(self, sample_tag):
        """Test tag serialization"""
        tag_dict = sample_tag.to_dict()

        assert tag_dict["name"] == "test-tag"
        assert "created_date" in tag_dict


@pytest.mark.unit
class TestResourceModels:
    def test_resource_config_creation(self, db_session):
        """Test resource config creation"""
        config = ResourceConfig(key="test_key", value="test_value", description="Test config")
        db_session.session.add(config)
        db_session.session.commit()

        assert config.id is not None
        assert config.key == "test_key"
        assert config.value == "test_value"

    def test_quick_access_creation(self, db_session):
        """Test quick access item creation"""
        item = QuickAccessItem(
            identifier="test-item",
            title="Test Item",
            subtitle="Test Subtitle",
            phone="555-0000",
            color="blue",
            icon="star",
        )
        db_session.session.add(item)
        db_session.session.commit()

        assert item.id is not None
        assert item.identifier == "test-item"

    def test_quick_access_to_dict(self, sample_quick_access):
        """Test quick access serialization"""
        item_dict = sample_quick_access.to_dict()

        assert item_dict["id"] == "emergency"  # Uses identifier as id
        assert item_dict["title"] == "Emergency"
        assert item_dict["phone"] == "911"

    def test_resource_item_creation(self, db_session):
        """Test resource item creation"""
        item = ResourceItem(
            title="Test Resource",
            url="https://test.com",
            description="Test description",
            category="Test Category",
            icon="building",
        )
        db_session.session.add(item)
        db_session.session.commit()

        assert item.id is not None
        assert item.title == "Test Resource"
        assert item.category == "Test Category"

    def test_resource_item_to_dict(self, sample_resource_item):
        """Test resource item serialization"""
        item_dict = sample_resource_item.to_dict()

        assert item_dict["title"] == "Test Resource"
        assert item_dict["category"] == "Government"
        assert item_dict["phone"] == "555-5678"
