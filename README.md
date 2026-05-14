# Judgify

Judgify is a tournament and competition platform with a Django REST API and a React/Vite frontend.

## Stack

- Backend: Django, Django REST Framework, PostgreSQL, Gunicorn, WhiteNoise
- Frontend: React, Vite
- Deployment: Render Blueprint (`render.yaml`)
- Local orchestration: Docker Compose

## Repository Layout

- `backend/` - Django API, data model, migrations, management commands
- `frontend/` - React application
- `render.yaml` - Render services and database blueprint
- `docker-compose.yml` - local development stack
- `SPECIFICATION.md` - product and engineering specification

## Configuration

Copy the example env files before running locally:

```bash
cp backend/.env.example backend/.env
cp backend/.env.docker.example backend/.env.docker
```

Production must set a unique `SECRET_KEY` and run with `DEBUG=0`. The application refuses to start in production with the local development secret.

Important backend variables:

```env
DEBUG=0
SECRET_KEY=<unique-production-secret>
DATABASE_URL=<postgres-connection-string>
ALLOWED_HOSTS=olympiad-api.onrender.com
CORS_ALLOWED_ORIGINS=https://olympiad-landing.onrender.com
CSRF_TRUSTED_ORIGINS=https://olympiad-landing.onrender.com
SEED_DEMO_DATA=1
SECURE_SSL_REDIRECT=1
```

Frontend production builds use:

```env
VITE_API_BASE_URL=https://olympiad-api.onrender.com/api
```

## Local Development

Run the full stack:

```bash
docker compose up --build
```

Local URLs:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8000/api/health/`
- Landing API: `http://localhost:8000/api/landing/competitions/`
- Django admin: `http://localhost:8000/admin/`

The Docker backend runs migrations on startup. Demo data is seeded only when `SEED_DEMO_DATA=1`, using the idempotent `seed_landing_if_empty` command.

## Manual Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_landing_if_empty
python manage.py runserver
```

On Windows, activate the virtual environment with:

```powershell
.venv\Scripts\activate
```

## Manual Frontend Setup

```bash
cd frontend
npm ci
npm run dev
```

## Data Integrity

Validate demo data consistency after seed changes:

```bash
cd backend
python manage.py validate_demo_integrity --warnings-as-errors
```

This checks competition states, rounds, participants, teams, submissions, judging assignments, scores, invitations, outbound messages, and stored files.

## Deployment

Render uses the Blueprint in `render.yaml`:

- `olympiad-db` PostgreSQL database
- `olympiad-api` Django/Gunicorn web service
- `olympiad-landing` static Vite build

The backend start command is `bash ./start.sh`, which runs migrations, optionally seeds demo data, and starts Gunicorn.

## Production Notes

- Do not commit `.env`, `.env.*`, local databases, caches, `node_modules`, or build artifacts.
- Do not create default admin users in startup scripts.
- Use `createsuperuser` or a secure one-off job for administrative accounts.
- Use `seed_landing_if_empty` for non-destructive demo data top-ups.
