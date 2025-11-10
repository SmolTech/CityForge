import os

from app import create_app, db

app = create_app()

if __name__ == "__main__":
    # Skip db.create_all() during migration phase - tables already exist from Prisma
    # with app.app_context():
    #     db.create_all()

    # Only bind to 0.0.0.0 in production (container), use localhost for development
    host = "0.0.0.0" if os.getenv("FLASK_ENV") == "production" else "127.0.0.1"
    app.run(host=host, port=5000, debug=os.getenv("FLASK_DEBUG", "False").lower() == "true")
