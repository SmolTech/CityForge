from __future__ import annotations

import importlib
import json
import logging
from collections.abc import Iterator
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch

from django.db.utils import OperationalError
from django.template import Context
from django.test import RequestFactory, TestCase

from apps.accounts.models import TokenBlacklist, User
from apps.classifieds.models import HelpWantedComment, HelpWantedPost
from apps.core.context_processors import site
from apps.core.db_monitoring import get_database_health
from apps.core.logging import JsonFormatter
from apps.core.management.commands.fix_imported_passwords import (
    Command as FixPasswordsCommand,
)
from apps.core.management.commands.fix_imported_passwords import (
    collect_password_hashes,
)
from apps.core.management.commands.import_prisma_export import (
    Command,
    collect_legacy_password_hashes,
    filter_to_fields,
    legacy_password_hash,
    normalize_row,
    snake,
    to_dt,
)
from apps.core.site_config import get_site_config, set_site_config
from apps.directory.models import Card, CardModification, CardSubmission, CardTag, Review, Tag
from apps.directory.templatetags.directory_extras import (
    business_address_url,
    highlight_safe,
    phone_href,
    query_replace,
    safe_external_url,
)
from apps.forums.models import ForumCategory, ForumPost, ForumThread
from apps.indexing.models import IndexingJob
from apps.resources.models import QuickAccessItem, ResourceCategory, ResourceConfig, ResourceItem


class SiteConfigTests(TestCase):
    class _BrokenRows:
        def __iter__(self) -> Iterator[tuple[str, str]]:
            raise OperationalError

    def test_get_site_config_uses_database_values(self) -> None:
        set_site_config("Configured Name", "Configured Tagline")
        config = get_site_config()
        self.assertEqual(config["SITE_NAME"], "Configured Name")
        self.assertEqual(config["SITE_TAGLINE"], "Configured Tagline")

    def test_get_site_config_falls_back_when_db_unavailable(self) -> None:
        with patch(
            "apps.resources.models.ResourceConfig.objects.filter", side_effect=OperationalError
        ):
            config = get_site_config()
        self.assertIn("SITE_NAME", config)
        self.assertIn("SITE_TAGLINE", config)

    def test_get_site_config_falls_back_when_query_eval_fails(self) -> None:
        with patch("apps.resources.models.ResourceConfig.objects.filter") as mocked_filter:
            mocked_filter.return_value.values_list.return_value = self._BrokenRows()
            config = get_site_config()

        self.assertIn("SITE_NAME", config)
        self.assertIn("SITE_TAGLINE", config)

    def test_context_processor_uses_site_config(self) -> None:
        request = RequestFactory().get("/")
        values = site(request)
        self.assertIn("SITE_NAME", values)
        self.assertIn("SITE_TAGLINE", values)


class LoggingTests(TestCase):
    def test_request_logging_sets_request_id_response_header(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers["X-Request-ID"])

    def test_request_logging_respects_forwarded_request_id(self) -> None:
        response = self.client.get("/api/health", HTTP_X_REQUEST_ID="req-123")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Request-ID"], "req-123")

    def test_json_formatter_serializes_expected_fields(self) -> None:
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="apps.core.tests",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="log-message",
            args=(),
            exc_info=None,
        )
        record.request_id = "req-123"
        record.method = "GET"
        record.path = "/api/health"
        record.status_code = 200
        payload = json.loads(formatter.format(record))

        self.assertEqual(payload["message"], "log-message")
        self.assertEqual(payload["request_id"], "req-123")
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["path"], "/api/health")
        self.assertEqual(payload["status_code"], 200)


class DatabaseMonitoringTests(TestCase):
    def test_health_endpoint_includes_database_metrics(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")

    def test_health_endpoint_returns_503_when_database_is_unhealthy(self) -> None:
        unhealthy = {
            "alias": "default",
            "vendor": "postgresql",
            "engine": "django.db.backends.postgresql",
            "connection_age_limit_seconds": 600,
            "healthy": False,
            "usable": False,
            "error": "database unavailable",
            "pool": {"supported": True, "status": "error"},
        }
        with patch("apps.core.views.get_database_health", return_value=unhealthy):
            response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "error")

    def test_get_database_health_reports_postgres_pool_metrics(self) -> None:
        class FakeCursor:
            description = [
                ("database_name",),
                ("backend_pid",),
                ("max_connections",),
                ("reserved_connections",),
                ("total_connections",),
                ("active_connections",),
                ("idle_connections",),
                ("waiting_connections",),
            ]

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb) -> None:
                return None

            def execute(self, _query: str) -> None:
                return None

            def fetchone(self) -> tuple[object, ...]:
                return ("community_db", 3210, 100, 3, 80, 12, 68, 2)

        class FakeConnection:
            alias = "default"
            vendor = "postgresql"
            settings_dict = {
                "ENGINE": "django.db.backends.postgresql",
                "CONN_MAX_AGE": 600,
            }

            def ensure_connection(self) -> None:
                return None

            def is_usable(self) -> bool:
                return True

            def cursor(self) -> FakeCursor:
                return FakeCursor()

        with (
            patch("apps.core.db_monitoring.connections", {"default": FakeConnection()}),
            self.settings(
                DB_POOL_WARNING_UTILIZATION_PERCENT=75,
                DB_POOL_WARNING_WAITING_CONNECTIONS=1,
            ),
        ):
            health = get_database_health()

        self.assertTrue(health["healthy"])
        self.assertTrue(health["pool"]["supported"])
        self.assertEqual(health["pool"]["status"], "warning")
        self.assertEqual(health["pool"]["database_name"], "community_db")
        self.assertEqual(health["pool"]["waiting_connections"], 2)
        self.assertEqual(health["pool"]["available_connections"], 97)
        self.assertEqual(health["pool"]["utilization_percent"], 82.47)


class TemplateTagTests(TestCase):
    def test_query_replace_updates_and_removes_values(self) -> None:
        request = RequestFactory().get("/?q=test&page=2")
        encoded = query_replace(Context({"request": request}), page=3, q=None, tag="x")
        self.assertIn("page=3", encoded)
        self.assertIn("tag=x", encoded)
        self.assertNotIn("q=", encoded)

    def test_safe_url_and_address_helpers(self) -> None:
        self.assertEqual(safe_external_url("javascript:alert(1)"), "")
        self.assertEqual(safe_external_url("https://example.com"), "https://example.com")
        self.assertIn("google.com/maps/search", business_address_url("123 Main St"))
        self.assertEqual(
            business_address_url("123 Main", "https://override.test"), "https://override.test"
        )

    def test_phone_and_highlight_helpers(self) -> None:
        self.assertEqual(phone_href("+1 (555) 123-4567"), "tel:+15551234567")
        self.assertEqual(phone_href("abc"), "")
        highlighted = highlight_safe("<em>City</em> & <script>")
        self.assertIn("<em>City</em>", highlighted)
        self.assertIn("&lt;script&gt;", highlighted)


class PrismaImportHelperTests(TestCase):
    def setUp(self) -> None:
        self.admin = User.objects.create_superuser("admin@example.com", "AdminPass!123")
        self.user = User.objects.create_user(
            "member@example.com",
            "MemberPass!123",
            first_name="Member",
            last_name="User",
        )

    def test_transform_helpers(self) -> None:
        self.assertEqual(snake("createdDate"), "created_date")
        self.assertIsNotNone(to_dt("2025-01-01T00:00:00Z"))
        self.assertIsNone(to_dt(None))
        bcrypt_hash = "$2b$12$" + ("a" * 53)
        hashed = legacy_password_hash(bcrypt_hash)
        self.assertIsNotNone(hashed)
        assert hashed is not None
        self.assertTrue(hashed.startswith("bcrypt$"))

        by_id, by_email = collect_legacy_password_hashes(
            {"items": [{"id": 10, "email": "U@E.COM", "passwordHash": bcrypt_hash}]}
        )
        self.assertIn(10, by_id)
        self.assertIn("u@e.com", by_email)

        normalized = normalize_row(
            {"createdBy": 1, "name": "A", "nested": {"x": 1}, "tags": [1, 2]},
            {"createdBy": "creator_id"},
        )
        self.assertEqual(normalized["creator_id"], 1)
        self.assertNotIn("nested", normalized)
        self.assertNotIn("tags", normalized)

        filtered = filter_to_fields(Card, {"name": "A", "made_up": 1})
        self.assertEqual(filtered, {"name": "A"})

    def test_import_command_dry_run_rolls_back(self) -> None:
        payload = {
            "User": [
                {
                    "id": 50,
                    "email": "rollback@example.com",
                    "firstName": "Rollback",
                    "lastName": "User",
                    "role": "user",
                }
            ]
        }
        with NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            tmp.write(json.dumps(payload))
            tmp_path = Path(tmp.name)
        try:
            out = StringIO()
            cmd = Command(stdout=out)
            cmd.handle(path=str(tmp_path), dry_run=True, only="", verbosity=0)
            self.assertFalse(User.objects.filter(email="rollback@example.com").exists())
            self.assertIn("Import complete.", out.getvalue())
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_import_command_calls_sync_sequences_when_not_dry_run(self) -> None:
        payload = {"User": [{"id": 51, "email": "persist@example.com", "firstName": "Persist"}]}
        with NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            tmp.write(json.dumps(payload))
            tmp_path = Path(tmp.name)
        try:
            cmd = Command(stdout=StringIO())
            with patch(
                "apps.core.management.commands.import_prisma_export.call_command"
            ) as mocked_call:
                cmd.handle(path=str(tmp_path), dry_run=False, only="", verbosity=1)
            mocked_call.assert_called_once_with("sync_sequences", verbosity=1)
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_per_model_importers_create_records(self) -> None:
        cmd = Command(stdout=StringIO())
        cmd._legacy_passwords_by_id = {}
        cmd._legacy_passwords_by_email = {}

        cmd._import_users(
            [
                {
                    "id": 100,
                    "email": "legacy@example.com",
                    "firstName": "Legacy",
                    "lastName": "User",
                    "role": "admin",
                    "createdDate": "2025-01-01T00:00:00Z",
                }
            ]
        )
        cmd._import_tags([{"id": 200, "name": "plumber", "createdDate": "2025-01-01T00:00:00Z"}])
        cmd._import_cards(
            [
                {
                    "id": 300,
                    "name": "Legacy Card",
                    "createdBy": 100,
                    "createdDate": "2025-01-01T00:00:00Z",
                    "updatedDate": "2025-01-01T00:00:00Z",
                }
            ]
        )
        cmd._import_card_tags([{"cardId": 300, "tagId": 200}])
        cmd._import_card_submissions(
            [
                {
                    "id": 400,
                    "name": "Submission",
                    "submittedBy": 100,
                    "status": "pending",
                    "createdDate": "2025-01-01T00:00:00Z",
                }
            ]
        )
        cmd._import_card_modifications(
            [
                {
                    "id": 410,
                    "cardId": 300,
                    "name": "Modification",
                    "submittedBy": 100,
                    "status": "pending",
                    "createdDate": "2025-01-01T00:00:00Z",
                }
            ]
        )
        cmd._import_reviews(
            [
                {
                    "id": 420,
                    "cardId": 300,
                    "userId": 100,
                    "rating": 5,
                    "createdDate": "2025-01-01T00:00:00Z",
                    "updatedDate": "2025-01-01T00:00:00Z",
                }
            ]
        )
        cmd._import_resource_categories([{"id": 500, "name": "Health"}])
        cmd._import_resource_items(
            [
                {
                    "id": 510,
                    "title": "Clinic",
                    "url": "https://clinic.example",
                    "description": "Care",
                    "category": "Health",
                    "icon": "hospital",
                    "categoryId": 500,
                }
            ]
        )
        cmd._import_quick_access(
            [
                {
                    "id": 520,
                    "identifier": "hotline",
                    "title": "Hotline",
                    "subtitle": "24/7",
                    "phone": "5551234",
                    "color": "red",
                    "icon": "phone",
                }
            ]
        )
        cmd._import_resource_config([{"id": 530, "key": "site_name", "value": "CityForge"}])
        cmd._import_forum_categories(
            [{"id": 600, "name": "General", "slug": "general", "createdBy": 100}]
        )
        cmd._import_forum_threads(
            [
                {
                    "id": 610,
                    "title": "Welcome",
                    "slug": "welcome",
                    "categoryId": 600,
                    "createdBy": 100,
                }
            ]
        )
        cmd._import_forum_posts(
            [{"id": 620, "threadId": 610, "content": "Hello", "createdBy": 100}]
        )
        cmd._import_help_posts(
            [
                {
                    "id": 700,
                    "title": "Need painter",
                    "description": "Wall painting",
                    "category": "home",
                    "createdBy": 100,
                }
            ]
        )
        cmd._import_help_comments(
            [{"id": 710, "postId": 700, "content": "I can help", "createdBy": 100}]
        )
        cmd._import_indexing([{"id": 800, "resourceId": 510, "status": "queued"}])
        cmd._import_token_blacklist(
            [
                {
                    "id": 900,
                    "jti": "blk1",
                    "tokenType": "access",
                    "userId": 100,
                    "revokedAt": "2025-01-01T00:00:00Z",
                    "expiresAt": "2025-01-02T00:00:00Z",
                },
                {
                    "jti": "blk2",
                    "tokenType": "refresh",
                    "userId": 100,
                    "revokedAt": "2025-01-01T00:00:00Z",
                    "expiresAt": "2025-01-02T00:00:00Z",
                },
            ]
        )

        self.assertTrue(User.objects.filter(pk=100).exists())
        self.assertTrue(Tag.objects.filter(pk=200).exists())
        self.assertTrue(Card.objects.filter(pk=300).exists())
        self.assertTrue(CardTag.objects.filter(card_id=300, tag_id=200).exists())
        self.assertTrue(CardSubmission.objects.filter(pk=400).exists())
        self.assertTrue(CardModification.objects.filter(pk=410).exists())
        self.assertTrue(Review.objects.filter(pk=420).exists())
        self.assertTrue(ResourceCategory.objects.filter(pk=500).exists())
        self.assertTrue(ResourceItem.objects.filter(pk=510).exists())
        self.assertTrue(QuickAccessItem.objects.filter(pk=520).exists())
        self.assertTrue(ResourceConfig.objects.filter(pk=530).exists())
        self.assertTrue(ForumCategory.objects.filter(pk=600).exists())
        self.assertTrue(ForumThread.objects.filter(pk=610).exists())
        self.assertTrue(ForumPost.objects.filter(pk=620).exists())
        self.assertTrue(HelpWantedPost.objects.filter(pk=700).exists())
        self.assertTrue(HelpWantedComment.objects.filter(pk=710).exists())
        self.assertTrue(IndexingJob.objects.filter(pk=800).exists())
        self.assertEqual(TokenBlacklist.objects.count(), 2)

    def test_sync_sequences_command_runs(self) -> None:
        out = StringIO()
        from django.core.management import call_command

        call_command("sync_sequences", stdout=out)
        self.assertTrue(
            "Synchronized" in out.getvalue() or "No sequences to synchronize." in out.getvalue()
        )


class BootstrapModuleTests(TestCase):
    def test_imports_asgi_wsgi_and_urls(self) -> None:
        asgi_module = importlib.import_module("cityforge.asgi")
        wsgi_module = importlib.import_module("cityforge.wsgi")
        urls_module = importlib.import_module("cityforge.urls")
        self.assertIsNotNone(asgi_module.application)
        self.assertIsNotNone(wsgi_module.application)
        self.assertTrue(any(str(p.pattern) == "api/cards" for p in urls_module.urlpatterns))
        self.assertTrue(any(str(p.pattern) == "api/health" for p in urls_module.urlpatterns))

    def test_health_endpoint_returns_ok(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_favicon_redirects_to_static_asset(self) -> None:
        response = self.client.get("/favicon.ico")
        self.assertEqual(response.status_code, 301)
        self.assertIn("/static/favicon", response["Location"])


class FixImportedPasswordsTests(TestCase):
    def test_collect_password_hashes_from_nested_relations(self) -> None:
        """Passwords in nested relations are collected even if missing from top-level User."""
        export_data = {
            "User": [
                {
                    "id": 1,
                    "email": "user1@example.com",
                    "firstName": "User",
                    "lastName": "One",
                }
            ],
            "Card": [
                {
                    "id": 100,
                    "name": "Test Card",
                    "creator": {
                        "id": 1,
                        "email": "user1@example.com",
                        "passwordHash": "$2b$12$mm.khEgvaI29Xz6F9R5c0O8PTJm51vr4CHRXEKXEYbYQqbUoiI.DW",
                    },
                }
            ],
        }
        by_email = collect_password_hashes(export_data)
        self.assertIn("user1@example.com", by_email)
        self.assertTrue(by_email["user1@example.com"].startswith("bcrypt$"))

    def test_fix_passwords_command_updates_unusable_passwords(self) -> None:
        """Command updates users with unusable passwords from export data."""
        # Create a user with unusable password
        user = User.objects.create_user(
            email="fixme@example.com",
            password=None,  # Creates unusable password
            first_name="Fix",
            last_name="Me",
        )
        self.assertFalse(user.has_usable_password())

        # Export with password hash
        export_data = {
            "Card": [
                {
                    "id": 100,
                    "name": "Card",
                    "creator": {
                        "id": 1,
                        "email": "fixme@example.com",
                        "passwordHash": "$2b$12$mm.khEgvaI29Xz6F9R5c0O8PTJm51vr4CHRXEKXEYbYQqbUoiI.DW",
                    },
                }
            ]
        }

        with NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            tmp.write(json.dumps(export_data))
            tmp_path = Path(tmp.name)

        try:
            cmd = FixPasswordsCommand(stdout=StringIO())
            cmd.handle(path=str(tmp_path), dry_run=False)

            user.refresh_from_db()
            self.assertTrue(user.has_usable_password())
            self.assertTrue(user.password.startswith("bcrypt$"))
        finally:
            tmp_path.unlink(missing_ok=True)
