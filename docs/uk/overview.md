# Judgify

Judgify - платформа для проведення турнірів, конкурсів та олімпіад із Django REST API та React/Vite frontend.

## Стек

- Backend: Django, Django REST Framework, PostgreSQL, Gunicorn, WhiteNoise
- Frontend: React, Vite
- Деплой: Render Blueprint (`render.yaml`)
- Локальний запуск: Docker Compose

## Структура репозиторію

- `backend/` - Django API, модель даних, міграції, management-команди
- `frontend/` - React застосунок
- `docs/` - документація українською та англійською
- `docs/architecture/` - PlantUML діаграми архітектури та сценаріїв
- `render.yaml` - Render сервіси та база даних
- `docker-compose.yml` - локальна інфраструктура

## Налаштування

Перед локальним запуском скопіюйте приклади env-файлів:

```bash
cp backend/.env.example backend/.env
cp backend/.env.docker.example backend/.env.docker
```

У production потрібно задати унікальний `SECRET_KEY` та запускати застосунок із `DEBUG=0`. Застосунок не повинен стартувати в production зі стандартним локальним секретом.

Важливі змінні backend:

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

Frontend production build використовує:

```env
VITE_API_BASE_URL=https://olympiad-api.onrender.com/api
```

## Локальна розробка

Запуск повного стеку:

```bash
docker compose up --build
```

Локальні адреси:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8000/api/health/`
- Landing API: `http://localhost:8000/api/landing/competitions/`
- Django admin: `http://localhost:8000/admin/`

Backend у Docker виконує міграції при старті. Demo data сідається лише коли `SEED_DEMO_DATA=1`, через ідемпотентну команду `seed_landing_if_empty`.

## Ручний запуск backend

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

На Windows активуйте venv так:

```powershell
.venv\Scripts\activate
```

## Ручний запуск frontend

```bash
cd frontend
npm ci
npm run dev
```

## Цілісність даних

Після змін у demo seed перевіряйте узгодженість:

```bash
cd backend
python manage.py validate_demo_integrity --warnings-as-errors
```

Команда перевіряє стани змагань, раунди, учасників, команди, подання, призначення суддів, оцінки, запрошення, повідомлення та збережені файли.

## Деплой

Render використовує Blueprint у `render.yaml`:

- `olympiad-db` - PostgreSQL база
- `olympiad-api` - Django/Gunicorn web service
- `olympiad-landing` - статичний Vite frontend

Backend стартує командою `bash ./start.sh`, яка виконує міграції, за потреби сідає demo data та запускає Gunicorn.

## Production нотатки

- Не комітити `.env`, `.env.*`, локальні бази, кеші, `node_modules` або build artifacts.
- Не створювати default admin users у startup scripts.
- Адмінів створювати через `createsuperuser` або безпечний one-off job.
- Для demo data використовувати не руйнівну команду `seed_landing_if_empty`.
