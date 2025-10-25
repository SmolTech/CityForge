#!/usr/bin/env python3
"""
Seed default data into CityForge database.

This script adds default configuration, quick access items, and resources.
Safe to run multiple times - it's idempotent (won't create duplicates).
"""
from app import create_app, db


def seed_data():
    """Seed all default data."""
    from app.models.resource import QuickAccessItem, ResourceConfig, ResourceItem

    app = create_app()

    with app.app_context():
        print("=" * 70)
        print("SEEDING DEFAULT DATA")
        print("=" * 70)

        # Site configuration
        print("\n[1/3] Site configuration...")
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
            (
                "footer_contact_email",
                "contact@example.com",
                "Resources page footer contact email",
            ),
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
            print(f"✓ Created {configs_created} configuration items")
        else:
            print("✓ Configuration already exists (skipped)")

        # Quick Access items
        print("\n[2/3] Quick access items...")
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
            print("✓ Quick access items already exist (skipped)")

        # Resource items
        print("\n[3/3] Resource items...")
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
            print("✓ Resource items already exist (skipped)")

        print("\n" + "=" * 70)
        print("✓ DATA SEEDING COMPLETE")
        print("=" * 70)


if __name__ == "__main__":
    seed_data()
