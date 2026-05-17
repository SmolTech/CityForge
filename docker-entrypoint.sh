#!/usr/bin/env sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Synchronizing database sequences..."
python manage.py sync_sequences --verbosity 0

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Ensuring superuser $DJANGO_SUPERUSER_EMAIL exists..."
  python manage.py shell <<PYEOF
import os
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.environ["DJANGO_SUPERUSER_EMAIL"]
password = os.environ["DJANGO_SUPERUSER_PASSWORD"]
user, created = User.objects.get_or_create(
    email=email,
    defaults={"first_name": "Admin", "last_name": "User", "role": "admin",
              "is_staff": True, "is_superuser": True, "email_verified": True},
)
if created:
    user.set_password(password)
    user.save()
    print(f"Created superuser {email}")
else:
    print(f"Superuser {email} already exists")
PYEOF
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Starting gunicorn on 0.0.0.0:${PORT:-8000}..."
exec gunicorn cityforge.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --access-logfile - \
  --error-logfile -
