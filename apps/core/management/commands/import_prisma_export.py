"""Import a JSON export from the legacy Next.js (Prisma) backend.

Usage:
    python manage.py import_prisma_export path/to/export.json [--dry-run] [--only Model[,Model...]]

The JSON is the structure produced by the old ``/api/admin/data/export`` endpoint:
a top-level object whose keys are Prisma model names (``User``, ``Card``, ...) and
whose values are arrays of records using camelCase keys.

Legacy bcrypt password hashes are preserved using Django's ``bcrypt$...``
password-hasher format so imported users can keep signing in. Some exports omit
``passwordHash`` from top-level ``User`` rows but include it in nested relation
payloads (for example ``Card.creator``); those nested hashes are collected
before users are imported.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterable
from datetime import datetime
from pathlib import Path
from typing import Any

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from apps.accounts.models import TokenBlacklist, User
from apps.classifieds.models import HelpWantedComment, HelpWantedPost
from apps.directory.models import (
    Card,
    CardModification,
    CardSubmission,
    CardTag,
    Review,
    Tag,
)
from apps.forums.models import ForumCategory, ForumPost, ForumThread
from apps.indexing.models import IndexingJob
from apps.resources.models import (
    QuickAccessItem,
    ResourceCategory,
    ResourceConfig,
    ResourceItem,
)

_CAMEL_RE = re.compile(r"(?<!^)(?=[A-Z])")
_BCRYPT_RE = re.compile(r"^\$2[aby]\$\d{2}\$.{53}$")


def snake(name: str) -> str:
    return _CAMEL_RE.sub("_", name).lower()


def to_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return parse_datetime(str(value))


def legacy_password_hash(value: Any) -> str | None:
    if isinstance(value, str) and _BCRYPT_RE.match(value):
        return f"bcrypt${value}"
    return None


def collect_legacy_password_hashes(data: Any) -> tuple[dict[int, str], dict[str, str]]:
    by_id: dict[int, str] = {}
    by_email: dict[str, str] = {}

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return

        password = legacy_password_hash(value.get("passwordHash") or value.get("password_hash"))
        if password:
            user_id = value.get("id")
            if isinstance(user_id, int):
                by_id.setdefault(user_id, password)
            email = value.get("email")
            if isinstance(email, str):
                by_email.setdefault(email.lower().strip(), password)

        for item in value.values():
            if isinstance(item, (dict, list)):
                visit(item)

    visit(data)
    return by_id, by_email


# Map of camelCase JSON keys → Django model field names where they differ.
# Anything not listed is passed through snake_case unchanged.
FK_RENAMES: dict[str, dict[str, str]] = {
    "User": {},
    "Card": {
        "createdBy": "creator_id",
        "approvedBy": "approver_id",
    },
    "CardSubmission": {
        "submittedBy": "submitter_id",
        "reviewedBy": "reviewer_id",
        "cardId": "card_id",
    },
    "CardModification": {
        "cardId": "card_id",
        "submittedBy": "submitter_id",
        "reviewedBy": "reviewer_id",
    },
    "Review": {
        "cardId": "card_id",
        "userId": "user_id",
        "reportedBy": "reporter_id",
    },
}


def normalize_row(row: dict[str, Any], renames: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        # Prisma exports include nested relation payloads (e.g. ``creator: {...}``
        # or ``tags: [...]``) alongside the scalar FK columns (``createdBy``,
        # ``card_tags``). Those nested objects cannot be assigned to Django model
        # fields, so drop anything that isn't a scalar.
        if isinstance(v, (dict, list)):
            continue
        if k in renames:
            out[renames[k]] = v
        else:
            out[snake(k)] = v
    return out


def _concrete_field_map(model) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for f in model._meta.get_fields():
        if getattr(f, "concrete", False) and not f.many_to_many:
            out[f.name] = f
            if hasattr(f, "attname"):
                out[f.attname] = f
    return out


def filter_to_fields(model, d: dict[str, Any]) -> dict[str, Any]:
    fields = _concrete_field_map(model)
    out: dict[str, Any] = {}
    for k, v in d.items():
        f = fields.get(k)
        if f is None:
            continue
        # If the value is None but the column is NOT NULL and has a default,
        # omit it so the model default applies instead of forcing a NULL write.
        if v is None and not f.null and f.has_default():
            continue
        out[k] = v
    return out


class Command(BaseCommand):
    help = "Import a Prisma JSON export into the Django database."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to export.json")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--only",
            help="Comma-separated subset of model names to import",
            default="",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.is_file():
            raise CommandError(f"File not found: {path}")
        data = json.loads(path.read_text())
        self._legacy_passwords_by_id, self._legacy_passwords_by_email = (
            collect_legacy_password_hashes(data)
        )
        only = {x.strip() for x in opts["only"].split(",") if x.strip()}
        dry = opts["dry_run"]

        importers: list[tuple[str, Callable[[Iterable[dict]], int]]] = [
            ("User", self._import_users),
            ("Tag", self._import_tags),
            ("Card", self._import_cards),
            ("card_tags", self._import_card_tags),
            ("CardSubmission", self._import_card_submissions),
            ("CardModification", self._import_card_modifications),
            ("Review", self._import_reviews),
            ("ResourceCategory", self._import_resource_categories),
            ("ResourceItem", self._import_resource_items),
            ("QuickAccessItem", self._import_quick_access),
            ("ResourceConfig", self._import_resource_config),
            ("ForumCategory", self._import_forum_categories),
            ("ForumThread", self._import_forum_threads),
            ("ForumPost", self._import_forum_posts),
            ("HelpWantedPost", self._import_help_posts),
            ("HelpWantedComment", self._import_help_comments),
            ("IndexingJob", self._import_indexing),
            ("TokenBlacklist", self._import_token_blacklist),
        ]

        try:
            with transaction.atomic():
                for key, fn in importers:
                    rows = data.get(key) or []
                    if only and key not in only:
                        continue
                    if not rows:
                        continue
                    count = fn(rows)
                    self.stdout.write(f"  {key}: {count} record(s)")
                if dry:
                    self.stdout.write(self.style.WARNING("Dry run — rolling back."))
                    raise _Rollback
        except _Rollback:
            pass

        self.stdout.write(self.style.SUCCESS("Import complete."))

    # ----- per-model importers -----

    def _import_users(self, rows):
        for r in rows:
            d = normalize_row(r, FK_RENAMES["User"])
            pk = d.pop("id")
            email = (d.get("email") or "").lower().strip()
            password = (
                legacy_password_hash(d.pop("password_hash", None))
                or self._legacy_passwords_by_id.get(pk)
                or self._legacy_passwords_by_email.get(email)
                or make_password(None)
            )
            for k in ("created_date", "last_login", "email_verification_sent_at"):
                if k in d:
                    d[k] = to_dt(d[k])
            User.objects.update_or_create(
                pk=pk,
                defaults={
                    "email": d.get("email"),
                    "first_name": d.get("first_name") or "",
                    "last_name": d.get("last_name") or "",
                    "role": d.get("role") or "user",
                    "is_active": d.get("is_active", True),
                    "is_staff": d.get("role") in ("admin", "support"),
                    "is_superuser": d.get("role") == "admin",
                    "email_verified": d.get("email_verified", False),
                    "email_verification_token": d.get("email_verification_token"),
                    "email_verification_sent_at": d.get("email_verification_sent_at"),
                    "registration_ip_address": d.get("registration_ip_address"),
                    "created_date": d.get("created_date") or datetime.now(),
                    "last_login": d.get("last_login"),
                    "password": password,
                },
            )
        return len(rows)

    def _import_tags(self, rows):
        for r in rows:
            Tag.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "name": r["name"],
                    "created_date": to_dt(r.get("createdDate")) or datetime.now(),
                },
            )
        return len(rows)

    def _import_cards(self, rows):
        for r in rows:
            d = normalize_row(r, FK_RENAMES["Card"])
            d["updated_date"] = to_dt(d.get("updated_date"))
            d["approved_date"] = to_dt(d.get("approved_date"))
            d["created_date"] = (
                to_dt(d.get("created_date"))
                or d["updated_date"]
                or d["approved_date"]
                or datetime.now()
            )
            pk = d.pop("id")
            Card.objects.update_or_create(pk=pk, defaults=filter_to_fields(Card, d))
        return len(rows)

    def _import_card_tags(self, rows):
        for r in rows:
            CardTag.objects.get_or_create(
                card_id=r.get("cardId") or r.get("card_id"),
                tag_id=r.get("tagId") or r.get("tag_id"),
            )
        return len(rows)

    def _import_card_submissions(self, rows):
        for r in rows:
            d = normalize_row(r, FK_RENAMES["CardSubmission"])
            d["created_date"] = to_dt(d.get("created_date"))
            d["reviewed_date"] = to_dt(d.get("reviewed_date"))
            pk = d.pop("id")
            CardSubmission.objects.update_or_create(pk=pk, defaults=filter_to_fields(CardSubmission, d))
        return len(rows)

    def _import_card_modifications(self, rows):
        for r in rows:
            d = normalize_row(r, FK_RENAMES["CardModification"])
            d["created_date"] = to_dt(d.get("created_date"))
            d["reviewed_date"] = to_dt(d.get("reviewed_date"))
            pk = d.pop("id")
            CardModification.objects.update_or_create(pk=pk, defaults=filter_to_fields(CardModification, d))
        return len(rows)

    def _import_reviews(self, rows):
        for r in rows:
            d = normalize_row(r, FK_RENAMES["Review"])
            d["created_date"] = to_dt(d.get("created_date"))
            d["updated_date"] = to_dt(d.get("updated_date"))
            d["reported_date"] = to_dt(d.get("reported_date"))
            pk = d.pop("id")
            Review.objects.update_or_create(pk=pk, defaults=filter_to_fields(Review, d))
        return len(rows)

    def _import_resource_categories(self, rows):
        for r in rows:
            d = normalize_row(r, {})
            pk = d.pop("id")
            ResourceCategory.objects.update_or_create(pk=pk, defaults=filter_to_fields(ResourceCategory, d))
        return len(rows)

    def _import_resource_items(self, rows):
        for r in rows:
            d = normalize_row(r, {"categoryId": "category_id"})
            pk = d.pop("id")
            ResourceItem.objects.update_or_create(pk=pk, defaults=filter_to_fields(ResourceItem, d))
        return len(rows)

    def _import_quick_access(self, rows):
        for r in rows:
            d = normalize_row(r, {})
            pk = d.pop("id")
            QuickAccessItem.objects.update_or_create(pk=pk, defaults=filter_to_fields(QuickAccessItem, d))
        return len(rows)

    def _import_resource_config(self, rows):
        for r in rows:
            d = normalize_row(r, {})
            pk = d.pop("id")
            ResourceConfig.objects.update_or_create(pk=pk, defaults=filter_to_fields(ResourceConfig, d))
        return len(rows)

    def _import_forum_categories(self, rows):
        for r in rows:
            d = normalize_row(r, {"createdBy": "creator_id"})
            pk = d.pop("id")
            ForumCategory.objects.update_or_create(pk=pk, defaults=filter_to_fields(ForumCategory, d))
        return len(rows)

    def _import_forum_threads(self, rows):
        for r in rows:
            d = normalize_row(r, {"createdBy": "creator_id", "categoryId": "category_id"})
            pk = d.pop("id")
            ForumThread.objects.update_or_create(pk=pk, defaults=filter_to_fields(ForumThread, d))
        return len(rows)

    def _import_forum_posts(self, rows):
        for r in rows:
            d = normalize_row(
                r,
                {
                    "createdBy": "creator_id",
                    "editedBy": "editor_id",
                    "threadId": "thread_id",
                },
            )
            pk = d.pop("id")
            ForumPost.objects.update_or_create(pk=pk, defaults=filter_to_fields(ForumPost, d))
        return len(rows)

    def _import_help_posts(self, rows):
        for r in rows:
            d = normalize_row(r, {"createdBy": "creator_id"})
            pk = d.pop("id")
            HelpWantedPost.objects.update_or_create(pk=pk, defaults=filter_to_fields(HelpWantedPost, d))
        return len(rows)

    def _import_help_comments(self, rows):
        for r in rows:
            d = normalize_row(r, {"createdBy": "creator_id", "postId": "post_id"})
            pk = d.pop("id")
            HelpWantedComment.objects.update_or_create(pk=pk, defaults=filter_to_fields(HelpWantedComment, d))
        return len(rows)

    def _import_indexing(self, rows):
        for r in rows:
            d = normalize_row(r, {})
            pk = d.pop("id")
            IndexingJob.objects.update_or_create(pk=pk, defaults=filter_to_fields(IndexingJob, d))
        return len(rows)

    def _import_token_blacklist(self, rows):
        for r in rows:
            d = normalize_row(r, {"userId": "user_id"})
            pk = d.pop("id", None)
            d = filter_to_fields(TokenBlacklist, d)
            if pk:
                TokenBlacklist.objects.update_or_create(pk=pk, defaults=d)
            else:
                TokenBlacklist.objects.update_or_create(jti=d["jti"], defaults=d)
        return len(rows)


class _Rollback(Exception):
    pass
