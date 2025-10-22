#!/usr/bin/env python3
"""
Master database initialization script for CityForge.

This script intelligently handles both fresh and existing databases:
- Fresh databases: Creates all tables and stamps with current migration version
- Existing databases: Runs pending migrations
- Both: Seeds default data if needed

Safe to run multiple times - it's idempotent.
Perfect for Kubernetes init containers and local development.
"""
import getpass
import os
import sys

from flask_migrate import stamp, upgrade
from sqlalchemy import inspect

from app import create_app, db


def is_database_empty():
    """Check if the database has any tables."""
    inspector = inspect(db.engine)
    return len(inspector.get_table_names()) == 0


def has_alembic_version_table():
    """Check if alembic_version table exists (indicates migrations are being used)."""
    inspector = inspect(db.engine)
    return "alembic_version" in inspector.get_table_names()


def initialize_fresh_database():
    """Initialize a completely fresh database."""
    print("=" * 70)
    print("FRESH DATABASE INITIALIZATION")
    print("=" * 70)

    print("\n[1/3] Creating all database tables...")
    db.create_all()
    print("✓ All tables created")

    print("\n[2/3] Stamping database with current migration version...")
    stamp(revision="head")
    print("✓ Database stamped (migration tracking enabled)")


def upgrade_existing_database():
    """Upgrade an existing database with pending migrations."""
    print("=" * 70)
    print("EXISTING DATABASE UPGRADE")
    print("=" * 70)

    print("\n[1/2] Running pending migrations...")
    try:
        upgrade()
        print("✓ Migrations applied successfully")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        print("\nTroubleshooting:")
        print("  1. Check if migrations are in sync: flask db current")
        print("  2. Review migration history: flask db history")
        print("  3. Check for manual schema changes that conflict with migrations")
        raise


def seed_default_data():
    """Seed default configuration data (idempotent)."""
    from app.models.resource import QuickAccessItem, ResourceConfig, ResourceItem

    print("\n[2/3] Seeding default configuration data...")

    # Site configuration
    config_defaults = [
        ("site_title", "Community Website", "Main site title"),
        (
            "site_description",
            "Helping connect people to the resources available to them.",
            "Main site description",
        ),
        ("site_domain", "community.local", "Site domain"),
        ("site_tagline", "Community Directory", "Site tagline for homepage"),
        (
            "site_directory_description",
            "Discover local businesses, events, news, and community resources. Search by name, description, or use tags to find exactly what you're looking for.",
            "Directory page description",
        ),
        ("site_copyright", "2025", "Copyright year"),
        ("site_copyright_holder", "Community", "Copyright holder name"),
        ("site_copyright_url", "#", "Copyright holder URL"),
        ("site_short_name", "Community", "Short site name"),
        ("site_full_name", "Community Website", "Full site name"),
        ("resources_title", "Local Resources", "Resources page title"),
        (
            "resources_description",
            "Essential links to local services and information",
            "Resources page description",
        ),
        ("footer_title", "Missing a Resource?", "Resources page footer title"),
        (
            "footer_description",
            "If you know of an important local resource that should be included on this page, please let us know.",
            "Resources page footer description",
        ),
        ("footer_contact_email", "contact@example.com", "Resources page footer contact email"),
        ("footer_button_text", "Suggest a Resource", "Resources page footer button text"),
        (
            "pagination_default_limit",
            "20",
            "Default number of items to display per page in directory listings",
        ),
    ]

    configs_created = 0
    for key, value, description in config_defaults:
        existing = ResourceConfig.query.filter_by(key=key).first()
        if not existing:
            config = ResourceConfig(key=key, value=value, description=description)
            db.session.add(config)
            configs_created += 1

    if configs_created > 0:
        db.session.commit()
        print(f"  ✓ Created {configs_created} configuration items")
    else:
        print("  ✓ Configuration already exists (skipped)")

    # Quick Access items
    quick_access_defaults = [
        ("emergency", "Emergency", "Call 911", "911", "red", "phone", 1),
        ("police", "Police", "Non-Emergency", "555-0100", "blue", "phone", 2),
        ("fire", "Fire Department", "Non-Emergency", "555-0101", "orange", "fire", 3),
        ("medical", "Medical", "Health Services", "555-0102", "green", "heart", 4),
    ]

    quick_access_created = 0
    for identifier, title, subtitle, phone, color, icon, order in quick_access_defaults:
        existing = QuickAccessItem.query.filter_by(identifier=identifier).first()
        if not existing:
            item = QuickAccessItem(
                identifier=identifier,
                title=title,
                subtitle=subtitle,
                phone=phone,
                color=color,
                icon=icon,
                display_order=order,
            )
            db.session.add(item)
            quick_access_created += 1

    if quick_access_created > 0:
        db.session.commit()
        print(f"  ✓ Created {quick_access_created} quick access items")
    else:
        print("  ✓ Quick access items already exist (skipped)")

    # Resource items
    resource_defaults = [
        (
            "Health & Wellness",
            "Local Hospital",
            "https://example.com/hospital",
            "Primary hospital serving the community with emergency and general medical services.",
            "555-0200",
            "123 Medical Ave",
            "building",
            1,
        ),
        (
            "Health & Wellness",
            "Community Health Clinic",
            "https://example.com/clinic",
            "Free and low-cost health services for community members.",
            "555-0201",
            "456 Care St",
            "heart",
            2,
        ),
        (
            "Government Services",
            "City Hall",
            "https://example.com/cityhall",
            "Municipal government offices and services.",
            "555-0300",
            "789 Main St",
            "building",
            1,
        ),
        (
            "Government Services",
            "Public Library",
            "https://example.com/library",
            "Free books, internet access, and community programs.",
            "555-0301",
            "321 Book Ln",
            "book",
            2,
        ),
        (
            "Education",
            "School District Office",
            "https://example.com/schools",
            "Information about local schools and educational programs.",
            "555-0400",
            "555 School Rd",
            "academic",
            1,
        ),
        (
            "Community Services",
            "Food Bank",
            "https://example.com/foodbank",
            "Free food assistance for families in need.",
            "555-0500",
            "111 Help Way",
            "heart",
            1,
        ),
    ]

    resources_created = 0
    for category, title, url, description, phone, address, icon, order in resource_defaults:
        existing = ResourceItem.query.filter_by(title=title, category=category).first()
        if not existing:
            item = ResourceItem(
                category=category,
                title=title,
                url=url,
                description=description,
                phone=phone,
                address=address,
                icon=icon,
                display_order=order,
            )
            db.session.add(item)
            resources_created += 1

    if resources_created > 0:
        db.session.commit()
        print(f"  ✓ Created {resources_created} resource items")
    else:
        print("  ✓ Resource items already exist (skipped)")


def create_admin_user(skip_prompt=False):
    """Create an admin user (idempotent)."""
    from app.models.user import User

    print("\n[3/3] Creating admin user...")

    # Check for environment variables (for init containers)
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if skip_prompt:
        if not admin_email or not admin_password:
            print("  ℹ Skipping (set ADMIN_EMAIL and ADMIN_PASSWORD environment variables)")
            return
    else:
        # Interactive mode
        if not admin_email:
            print()
            admin_email = input("Enter admin email address (or press Enter to skip): ").strip()

        if not admin_email:
            print("  ℹ Skipping admin user creation")
            return

    # Check if user already exists
    admin_user = User.query.filter_by(email=admin_email).first()
    if admin_user:
        print(f"  ✓ Admin user already exists: {admin_email} (skipped)")
        return

    if not skip_prompt and not admin_password:
        admin_password = getpass.getpass("Enter admin password: ")
        admin_password_confirm = getpass.getpass("Confirm admin password: ")

        if not admin_password:
            print("  ℹ Skipping admin user creation (no password provided)")
            return

        if admin_password != admin_password_confirm:
            print("  ✗ Error: Passwords do not match")
            if not skip_prompt:
                sys.exit(1)
            return

    # Validate password
    is_valid, message = User.validate_password(admin_password)
    if not is_valid:
        print(f"  ✗ Error: {message}")
        if not skip_prompt:
            sys.exit(1)
        return

    # Create admin user
    admin_user = User(email=admin_email, first_name="Admin", last_name="User", role="admin")
    # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
    admin_user.set_password(admin_password)

    db.session.add(admin_user)
    db.session.commit()
    print(f"  ✓ Admin user created: {admin_email}")


def initialize_database(skip_admin_prompt=False):
    """
    Initialize the database intelligently.

    Detects whether this is a fresh database or an existing one,
    and handles it appropriately.
    """
    app = create_app()

    with app.app_context():
        # Determine database state
        is_empty = is_database_empty()
        has_migrations = has_alembic_version_table()

        print("\nDatabase Status:")
        print(f"  Empty database: {'Yes' if is_empty else 'No'}")
        print(f"  Migration tracking: {'Enabled' if has_migrations else 'Not yet initialized'}")
        print()

        if is_empty:
            # Fresh database - create everything
            initialize_fresh_database()
        elif has_migrations:
            # Existing database with migrations - run upgrades
            upgrade_existing_database()
        else:
            # Database has tables but no migration tracking
            # This is the problematic state the issue describes
            print("⚠ WARNING: Database has tables but no migration tracking!")
            print()
            print("This state occurs when tables were created with db.create_all()")
            print("instead of using Flask-Migrate.")
            print()
            print("To fix this, you need to:")
            print("  1. Backup your database")
            print("  2. Choose one of these options:")
            print()
            print("  Option A - Add migration tracking to existing DB:")
            print("    flask db stamp head")
            print("    flask db upgrade")
            print()
            print("  Option B - Start fresh (DATA WILL BE LOST):")
            print("    DROP DATABASE and run this script again")
            print()
            sys.exit(1)

        # Seed default data (safe for both fresh and existing databases)
        seed_default_data()

        # Create admin user if needed
        create_admin_user(skip_prompt=skip_admin_prompt)

        # Success message
        print("\n" + "=" * 70)
        print("✓ DATABASE INITIALIZATION COMPLETE")
        print("=" * 70)
        print("\nNext steps:")
        print("  • Access admin panel: http://your-domain/admin")
        print("  • Configure site settings")
        print("  • Add business cards and resources")
        print()
        print("For future schema changes:")
        print("  flask db migrate -m 'Description of changes'")
        print("  flask db upgrade")
        print()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Initialize CityForge database (fresh or existing)"
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run in non-interactive mode (for init containers). Uses ADMIN_EMAIL and ADMIN_PASSWORD from environment.",
    )
    args = parser.parse_args()

    try:
        initialize_database(skip_admin_prompt=args.non_interactive)
    except Exception as e:
        print(f"\n✗ Initialization failed: {e}", file=sys.stderr)
        sys.exit(1)
