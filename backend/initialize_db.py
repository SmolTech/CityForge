#!/usr/bin/env python3
"""
Master database initialization script for CityForge.

This script intelligently handles both fresh and existing databases:
- Fresh databases: Creates all tables and stamps with current migration version
- Existing databases: Runs pending migrations
- Both: Seeds default data if needed

Safe to run multiple times - it's idempotent.
Perfect for Kubernetes init containers and local development.

Note: Admin user creation has been moved to create_admin_user.py
Run that script separately after database initialization.
"""
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


def fix_sequences():
    """Fix PostgreSQL sequences to match current max IDs."""
    from sqlalchemy import text

    # Get all tables with id sequences
    tables_with_sequences = [
        "users",
        "cards",
        "tags",
        "card_submissions",
        "card_modifications",
        "resource_categories",
        "resource_items",
        "quick_access_items",
        "resource_config",
        "help_wanted_posts",
        "help_wanted_comments",
        "help_wanted_reports",
        "forum_categories",
        "forum_category_requests",
        "forum_threads",
        "forum_posts",
        "forum_reports",
        "reviews",
        "indexing_jobs",
        "support_tickets",
        "support_ticket_messages",
        "token_blacklist",
    ]

    for table in tables_with_sequences:
        try:
            # Reset sequence to max(id) + 1
            # Note: table names are hardcoded above, not user input
            sequence_name = f"{table}_id_seq"
            # nosemgrep: python.sqlalchemy.security.audit.avoid-sqlalchemy-text.avoid-sqlalchemy-text
            max_id_query = text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
            max_id = db.session.execute(max_id_query).scalar() or 0

            setval_query = text("SELECT setval(:sequence, :max_val, true)")
            db.session.execute(setval_query, {"sequence": sequence_name, "max_val": max(max_id, 1)})
        except Exception:
            # Skip if table or sequence doesn't exist
            pass

    db.session.commit()


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

    print("\n[3/3] Fixing database sequences...")
    fix_sequences()
    print("✓ Sequences fixed")


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

    print("\n[3/4] Seeding default configuration data...")

    # Check if this is an imported database (has substantial data already)
    resource_count = ResourceItem.query.count()
    quick_access_count = QuickAccessItem.query.count()

    if resource_count > 0 or quick_access_count > 0:
        print("  ℹ Data already exists in database (likely imported)")
        print(f"    - ResourceItems: {resource_count}")
        print(f"    - QuickAccessItems: {quick_access_count}")
        print("  ✓ Skipping default data seeding to avoid conflicts")
        return

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
        (
            "google_analytics_id",
            "",
            "Google Analytics measurement ID (e.g., G-XXXXXXXXXX) - leave empty to disable",
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

    # Quick Access items - only seed if database is truly empty
    # Don't re-create default items if they were intentionally deleted by admin
    if quick_access_count == 0 and resource_count == 0:
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
    else:
        print("  ✓ Skipping default quick access items (database has existing data)")

    # Resource items - only seed if database is truly empty
    # Don't re-create default items if they were intentionally deleted by admin
    if quick_access_count == 0 and resource_count == 0:
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
    else:
        print("  ✓ Skipping default resource items (database has existing data)")


def check_admin_user():
    """Check if an admin user exists and provide guidance."""
    from app.models.user import User

    print("\n[4/4] Checking for admin user...")

    # Check if any admin user exists
    admin_user = User.query.filter_by(role="admin").first()
    if admin_user:
        print(f"  ✓ Admin user exists: {admin_user.email}")
        return

    print("  ℹ No admin user found")
    print("\n  To create an admin user, run:")
    print("    python create_admin_user.py")
    print("\n  Or with environment variables:")
    print("    ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=SecurePass123! \\")
    print("      python create_admin_user.py --non-interactive")


def initialize_database():
    """
    Initialize the database intelligently.

    Detects whether this is a fresh database or an existing one,
    and handles it appropriately.

    Note: Admin user creation has been moved to a separate script.
    Run create_admin_user.py after initialization to create an admin user.
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

        # Check for admin user
        check_admin_user()

        # Success message
        print("\n" + "=" * 70)
        print("✓ DATABASE INITIALIZATION COMPLETE")
        print("=" * 70)
        print("\nNext steps:")
        print("  • Create admin user (if needed): python create_admin_user.py")
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
        description="Initialize CityForge database (fresh or existing)",
        epilog="To create an admin user after initialization, run: python create_admin_user.py",
    )
    args = parser.parse_args()

    try:
        initialize_database()
    except Exception as e:
        print(f"\n✗ Initialization failed: {e}", file=sys.stderr)
        sys.exit(1)
