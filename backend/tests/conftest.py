import os

import pytest

from app import create_app, db
from app.models import Card, QuickAccessItem, ResourceConfig, ResourceItem, Tag, User
from app.models.token_blacklist import TokenBlacklist


@pytest.fixture(scope="session")
def app():
    """Create application for testing"""
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"
    os.environ["FLASK_ENV"] = "testing"

    app = create_app()
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "WTF_CSRF_ENABLED": False,
            "JWT_SECRET_KEY": "test-secret-key",
        }
    )

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """Create test CLI runner"""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def db_session(app):
    """Create database session for a test"""
    with app.app_context():
        db.create_all()
        yield db
        db.session.remove()
        db.drop_all()


@pytest.fixture
def admin_user(db_session):
    """Create admin user for testing"""
    user = User(email="admin@test.com", first_name="Admin", last_name="User", role="admin")
    user.set_password("AdminPass123")
    db_session.session.add(user)
    db_session.session.commit()
    return user


@pytest.fixture
def regular_user(db_session):
    """Create regular user for testing"""
    user = User(email="user@test.com", first_name="Regular", last_name="User", role="user")
    user.set_password("UserPass123")
    db_session.session.add(user)
    db_session.session.commit()
    return user


@pytest.fixture
def admin_token(client, admin_user):
    """Get JWT token for admin user"""
    response = client.post(
        "/api/auth/login", json={"email": "admin@test.com", "password": "AdminPass123"}
    )
    return response.json["access_token"]


@pytest.fixture
def user_token(client, regular_user):
    """Get JWT token for regular user"""
    response = client.post(
        "/api/auth/login", json={"email": "user@test.com", "password": "UserPass123"}
    )
    return response.json["access_token"]


@pytest.fixture
def sample_tag(db_session):
    """Create sample tag"""
    tag = Tag(name="test-tag")
    db_session.session.add(tag)
    db_session.session.commit()
    return tag


@pytest.fixture
def sample_card(db_session, admin_user, sample_tag):
    """Create sample card"""
    card = Card(
        name="Test Business",
        description="Test description",
        website_url="https://test.com",
        phone_number="555-1234",
        email="test@business.com",
        address="123 Test St",
        contact_name="Test Contact",
        featured=True,
        approved=True,
        created_by=admin_user.id,
        approved_by=admin_user.id,
    )
    card.tags.append(sample_tag)
    db_session.session.add(card)
    db_session.session.commit()
    return card


@pytest.fixture
def sample_resource_config(db_session):
    """Create sample resource configuration"""
    config = ResourceConfig(
        key="site_title", value="Test Site", description="Site title for testing"
    )
    db_session.session.add(config)
    db_session.session.commit()
    return config


@pytest.fixture
def sample_quick_access(db_session):
    """Create sample quick access item"""
    item = QuickAccessItem(
        identifier="emergency",
        title="Emergency",
        subtitle="911",
        phone="911",
        color="red",
        icon="phone",
        display_order=1,
    )
    db_session.session.add(item)
    db_session.session.commit()
    return item


@pytest.fixture
def sample_resource_item(db_session):
    """Create sample resource item"""
    item = ResourceItem(
        title="Test Resource",
        url="https://test-resource.com",
        description="Test resource description",
        category="Government",
        phone="555-5678",
        address="456 Resource Ave",
        icon="building",
        display_order=1,
    )
    db_session.session.add(item)
    db_session.session.commit()
    return item
