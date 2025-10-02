from app import create_app, db
from datetime import datetime
import getpass
import sys
import re

def init_database():
    app = create_app()

    with app.app_context():
        db.create_all()

        print("Database tables created successfully!")

        from app.models.user import User

        # Create admin user
        print("\n=== Admin User Setup ===")
        admin_email = input("Enter admin email address: ").strip()

        if not admin_email:
            print("Error: Email address is required")
            sys.exit(1)

        admin_user = User.query.filter_by(email=admin_email).first()
        if admin_user:
            print(f"Admin user with email {admin_email} already exists")
        else:
            admin_password = getpass.getpass("Enter admin password: ")
            admin_password_confirm = getpass.getpass("Confirm admin password: ")

            if not admin_password:
                print("Error: Password is required")
                sys.exit(1)

            if admin_password != admin_password_confirm:
                print("Error: Passwords do not match")
                sys.exit(1)

            # Validate password before creating user
            is_valid, message = User.validate_password(admin_password)
            if not is_valid:
                print(f"Error: {message}")
                sys.exit(1)

            admin_user = User(
                email=admin_email,
                first_name='Admin',
                last_name='User',
                role='admin'
            )
            # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
            admin_user.set_password(admin_password)

            db.session.add(admin_user)
            db.session.commit()
            print(f"Admin user created: {admin_email}")

        print("\nDatabase initialization completed successfully!")

if __name__ == '__main__':
    init_database()