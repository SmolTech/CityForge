#!/usr/bin/env python3
"""
Create an admin user for CityForge.

This script creates a new admin user in the database.
Can be run interactively or with environment variables for automation.

Usage:
    # Interactive mode (prompts for email and password)
    python create_admin_user.py

    # Non-interactive mode (uses environment variables)
    export ADMIN_EMAIL=admin@example.com
    export ADMIN_PASSWORD=SecurePassword123!
    python create_admin_user.py --non-interactive

    # Specify email/password as arguments
    python create_admin_user.py --email admin@example.com --password SecurePassword123!
"""
import argparse
import getpass
import os
import sys

from app import create_app, db


def create_admin_user(email, password, first_name="Admin", last_name="User"):
    """
    Create an admin user.

    Args:
        email: Admin user email
        password: Admin user password
        first_name: First name (default: Admin)
        last_name: Last name (default: User)

    Returns:
        Tuple of (success: bool, message: str)
    """
    from app.models.user import User

    # Check if user already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return False, f"User with email {email} already exists"

    # Validate password
    is_valid, validation_message = User.validate_password(password)
    if not is_valid:
        return False, validation_message

    # Create admin user
    admin_user = User(email=email, first_name=first_name, last_name=last_name, role="admin")
    # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
    admin_user.set_password(password)

    db.session.add(admin_user)
    db.session.commit()

    return True, f"Admin user created successfully: {email}"


def main():
    """Main entry point for creating admin user."""
    parser = argparse.ArgumentParser(
        description="Create an admin user for CityForge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode
  python create_admin_user.py

  # Non-interactive with environment variables
  export ADMIN_EMAIL=admin@example.com
  export ADMIN_PASSWORD=SecurePassword123!
  python create_admin_user.py --non-interactive

  # With command line arguments
  python create_admin_user.py --email admin@example.com --password SecurePass123!
        """,
    )
    parser.add_argument("--email", help="Admin user email address")
    parser.add_argument("--password", help="Admin user password")
    parser.add_argument("--first-name", default="Admin", help="Admin user first name (default: Admin)")
    parser.add_argument("--last-name", default="User", help="Admin user last name (default: User)")
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run in non-interactive mode (uses environment variables if email/password not provided)",
    )

    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        # Get email
        email = args.email or os.getenv("ADMIN_EMAIL")

        if not email and not args.non_interactive:
            email = input("Enter admin email address: ").strip()

        if not email:
            print("Error: Email address is required", file=sys.stderr)
            print("Provide via --email, ADMIN_EMAIL env var, or interactive prompt", file=sys.stderr)
            sys.exit(1)

        # Get password
        password = args.password or os.getenv("ADMIN_PASSWORD")

        if not password and not args.non_interactive:
            password = getpass.getpass("Enter admin password: ")
            password_confirm = getpass.getpass("Confirm admin password: ")

            if password != password_confirm:
                print("Error: Passwords do not match", file=sys.stderr)
                sys.exit(1)

        if not password:
            print("Error: Password is required", file=sys.stderr)
            print(
                "Provide via --password, ADMIN_PASSWORD env var, or interactive prompt", file=sys.stderr
            )
            sys.exit(1)

        # Create admin user
        success, message = create_admin_user(
            email=email, password=password, first_name=args.first_name, last_name=args.last_name
        )

        if success:
            print(f"✓ {message}")
            print("\nYou can now log in with:")
            print(f"  Email: {email}")
            print(f"  Role: admin")
            sys.exit(0)
        else:
            print(f"✗ Error: {message}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
