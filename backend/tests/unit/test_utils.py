import pytest
from app.utils.helpers import generate_slug, allowed_file, require_admin
from app.models import User


@pytest.mark.unit
class TestHelpers:
    def test_generate_slug_basic(self):
        """Test basic slug generation"""
        assert generate_slug("Test Business") == "test-business"

    def test_generate_slug_special_chars(self):
        """Test slug with special characters"""
        assert generate_slug("Test & Special! Business") == "test-special-business"

    def test_generate_slug_multiple_spaces(self):
        """Test slug with multiple spaces"""
        assert generate_slug("Test   Multiple   Spaces") == "test-multiple-spaces"

    def test_generate_slug_leading_trailing_hyphens(self):
        """Test slug strips leading/trailing hyphens"""
        assert generate_slug("-Test Business-") == "test-business"

    def test_generate_slug_unicode(self):
        """Test slug with unicode characters (preserves unicode)"""
        assert generate_slug("Café Restaurant") == "café-restaurant"

    def test_allowed_file_valid_extensions(self):
        """Test allowed file extensions"""
        assert allowed_file("image.png") is True
        assert allowed_file("photo.jpg") is True
        assert allowed_file("picture.jpeg") is True
        assert allowed_file("graphic.gif") is True
        assert allowed_file("image.webp") is True

    def test_allowed_file_invalid_extensions(self):
        """Test disallowed file extensions"""
        assert allowed_file("script.exe") is False
        assert allowed_file("document.pdf") is False
        assert allowed_file("archive.zip") is False
        assert allowed_file("noextension") is False

    def test_allowed_file_case_insensitive(self):
        """Test file extension check is case insensitive"""
        assert allowed_file("IMAGE.PNG") is True
        assert allowed_file("Photo.JPG") is True

    def test_require_admin_with_admin(self, app, admin_user):
        """Test require_admin with admin user"""
        with app.app_context():
            from flask_jwt_extended import create_access_token
            from flask import Flask
            from unittest.mock import patch

            token = create_access_token(identity=admin_user.id)

            with patch("app.utils.helpers.get_jwt_identity", return_value=admin_user.id):
                result = require_admin()
                assert result is None

    def test_require_admin_with_regular_user(self, app, regular_user):
        """Test require_admin with regular user"""
        with app.app_context():
            from flask_jwt_extended import create_access_token
            from unittest.mock import patch

            token = create_access_token(identity=regular_user.id)

            with patch("app.utils.helpers.get_jwt_identity", return_value=regular_user.id):
                result = require_admin()
                assert result is not None
                assert result[1] == 403
