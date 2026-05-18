"""Fix passwords for users imported without password hashes.

When importing from a Prisma export that lacks passwords in top-level User records,
users get assigned unusable passwords (make_password(None)). This command re-imports
password hashes from another Prisma export file, updating only users with unusable
passwords.

Usage:
    python manage.py fix_imported_passwords path/to/export.json [--dry-run]
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User

_BCRYPT_RE = re.compile(r"^\$2[aby]\$\d{2}\$.{53}$")


def legacy_password_hash(value: Any) -> str | None:
    if isinstance(value, str) and _BCRYPT_RE.match(value):
        return f"bcrypt${value}"
    return None


def collect_password_hashes(data: Any) -> dict[str, str]:
    """Collect email → password mappings from nested relations in export."""
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
            email = value.get("email")
            if isinstance(email, str):
                by_email.setdefault(email.lower().strip(), password)

        for item in value.values():
            if isinstance(item, dict | list):
                visit(item)

    visit(data)
    return by_email


class Command(BaseCommand):
    help = "Fix passwords for users with unusable hashes after Prisma import."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to Prisma export.json")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.is_file():
            raise CommandError(f"File not found: {path}")

        data = json.loads(path.read_text())
        by_email = collect_password_hashes(data)

        if not by_email:
            self.stdout.write(self.style.WARNING("No password hashes found in export."))
            return

        self.stdout.write(f"Found {len(by_email)} password hashes in export.")

        # Find users with unusable passwords and update them
        updated = 0
        skipped = 0
        dry = opts["dry_run"]

        for user in User.objects.all():
            email = user.email.lower().strip()
            if email not in by_email:
                continue

            if not user.has_usable_password():
                new_password = by_email[email]
                if not dry:
                    user.password = new_password
                    user.save(update_fields=["password"])
                updated += 1
                self.stdout.write(f"  ✓ {email}")
            else:
                skipped += 1

        self.stdout.write(f"\nUpdated: {updated} users")
        self.stdout.write(f"Skipped: {skipped} users (already have usable passwords)")

        if dry:
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
