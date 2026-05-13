#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DB_HOST:-}" ]]; then
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
fi

python manage.py migrate

if [[ "${SEED_DEMO_DATA:-0}" == "1" ]]; then
    python manage.py seed_landing_if_empty
fi

if [[ "${DJANGO_CREATE_SUPERUSER:-0}" == "1" ]]; then
    python manage.py createsuperuser --noinput
fi

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
