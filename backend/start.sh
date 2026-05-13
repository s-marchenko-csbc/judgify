#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
import os, socket, time
host = os.getenv('DB_HOST', 'db')
port = int(os.getenv('DB_PORT', '5432'))
for attempt in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"Database is reachable at {host}:{port}")
            break
    except OSError as exc:
        print(f"Waiting for database {host}:{port}... ({attempt + 1}/60) {exc}", flush=True)
        time.sleep(2)
else:
    raise SystemExit("Database did not become reachable")
PY

python manage.py migrate
python manage.py seed_landing
python manage.py shell <<'PY'
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin12345')
PY
python manage.py runserver 0.0.0.0:8000
