#!/usr/bin/env python3
"""
Initialize a fresh CityForge database from scratch.

This script properly initializes a new database by:
1. Creating all tables using db.create_all()
2. Stamping the database with the current migration version
3. Seeding default configuration data
4. Creating an admin user

This avoids conflicts between db.create_all() and flask db upgrade.
"""
import getpass
import os
import sys

from flask_migrate import stamp
from sqlalchemy import inspect, text

from app import create_app, db


def is_database_empty():
    """Check if the database has any tables."""
    inspector = inspect(db.engine)
    return len(inspector.get_table_names()) == 0


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    db.create_all()
    print("✓ Database tables created successfully")


def stamp_database():
    """Stamp the database with the current migration version."""
    print("\nStamping database with current migration version...")
    stamp(revision="head")
    print("✓ Database stamped with migration version")


def seed_default_data():
    """Seed default configuration data."""
    from app.models.resource import QuickAccessItem, ResourceConfig, ResourceItem

    print("\n=== Seeding Default Configuration ===")

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
        print(f"✓ Created {configs_created} configuration items")
    else:
        print("✓ Configuration already exists")

    # Quick Access items
    print("\n=== Seeding Quick Access Items ===")
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
        print(f"✓ Created {quick_access_created} quick access items")
    else:
        print("✓ Quick access items already exist")

    # Resource items
    print("\n=== Seeding Resource Items ===")
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
        print(f"✓ Created {resources_created} resource items")
    else:
        print("✓ Resource items already exist")


def create_admin_user(skip_prompt=False):
    """Create an admin user."""
    from app.models.user import User

    print("\n=== Creating Admin User ===")

    # Check for environment variables (for init containers)
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if skip_prompt:
        if not admin_email or not admin_password:
            print("ℹ Skipping admin user creation (set ADMIN_EMAIL and ADMIN_PASSWORD to create)")
            return
    else:
        # Interactive mode
        if not admin_email:
            admin_email = input("Enter admin email address: ").strip()

        if not admin_email:
            print("Error: Email address is required")
            sys.exit(1)

    # Check if user already exists
    admin_user = User.query.filter_by(email=admin_email).first()
    if admin_user:
        print(f"ℹ Admin user with email {admin_email} already exists")
        return

    if not skip_prompt and not admin_password:
        admin_password = getpass.getpass("Enter admin password: ")
        admin_password_confirm = getpass.getpass("Confirm admin password: ")

        if not admin_password:
            print("Error: Password is required")
            sys.exit(1)

        if admin_password != admin_password_confirm:
            print("Error: Passwords do not match")
            sys.exit(1)

    # Validate password
    is_valid, message = User.validate_password(admin_password)
    if not is_valid:
        print(f"Error: {message}")
        if not skip_prompt:
            sys.exit(1)
        return

    # Create admin user
    admin_user = User(email=admin_email, first_name="Admin", last_name="User", role="admin")
    # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
    admin_user.set_password(admin_password)

    db.session.add(admin_user)
    db.session.commit()
    print(f"✓ Admin user created: {admin_email}")


def init_fresh_database(skip_admin_prompt=False):
    """Initialize a fresh database from scratch."""
    app = create_app()

    with app.app_context():
        # Check if database is empty
        if not is_database_empty():
            print("⚠ Database is not empty!")
            print("This script is only for initializing fresh databases.")
            print("For existing databases, use: flask db upgrade")
            sys.exit(1)

        # Create all tables
        create_tables()

        # Stamp database with current migration version
        # This prevents migrations from trying to recreate tables
        stamp_database()

        # Seed default data
        seed_default_data()

        # Create admin user
        create_admin_user(skip_prompt=skip_admin_prompt)

        print("\n" + "=" * 60)
        print("✓ Database initialization completed successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Configure your site settings in the admin panel")
        print("2. Add business cards and resources")
        print("3. Customize Quick Access items")
        print("\nFor future schema changes, use Flask-Migrate:")
        print("  flask db migrate -m 'Description'")
        print("  flask db upgrade")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Initialize a fresh CityForge database from scratch"
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run in non-interactive mode (for init containers). Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment.",
    )
    args = parser.parse_args()

    init_fresh_database(skip_admin_prompt=args.non_interactive)
