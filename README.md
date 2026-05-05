# Judgify Landing Demo

## Project change notes

Current package version: `v16`.

Version history is maintained in [`CHANGELOG.md`](CHANGELOG.md). Update it together with every project archive so model, API, UI and workflow changes do not get lost between iterations.


Демо-проєкт лендінгу платформи змагань на стеку:
- React (Vite)
- Django + Django REST Framework
- PostgreSQL

## Структура

- `backend/` — Django API
- `frontend/` — React UI

## 1. Швидкий запуск через Docker

У корені проєкту:

```bash
docker compose up --build
```

Після запуску:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/landing/competitions/
- Django admin: http://localhost:8000/admin/

## 2. Demo-користувач

Після першого старту автоматично створюється:
- username: `demo_user`
- password: `demo12345`

Суперкористувач за замовчуванням:
- username: `admin`
- password: `admin12345`

## 3. Локальний запуск без Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Linux / macOS
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py makemigrations landing
python manage.py migrate
python manage.py seed_landing
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 4. Налаштування БД

За замовчуванням проєкт очікує PostgreSQL. Для Docker все вже налаштовано.

Для локального запуску створіть БД і пропишіть змінні в `backend/.env`:

```env
DEBUG=1
SECRET_KEY=dev-secret-key
ALLOWED_HOSTS=127.0.0.1,localhost
DB_NAME=judgify
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## 5. Основні API

- `GET /api/landing/filters/`
- `GET /api/landing/competitions/`
- `GET /api/landing/sidebar/`

## 6. Фільтрація

`GET /api/landing/competitions/?tab=trending&status=active&participation_type=team&industry=programming`

Підтримуються параметри:
- `search`
- `tab`
- `status`
- `event_type`
- `participation_type`
- `industry`
- `difficulty`

## 7. Що віддає БД для UI

### Центральні картки
- назва
- фонове зображення змагання
- поточний раунд / загальна кількість раундів
- кількість учасників
- competition status
- таймер до `timer_deadline`
- прапори `submissions_open`, `is_live_stream_enabled`, `is_saved`

### Права панель
- до 6 останніх змагань у форматі вузьких банерів
- збережені змагання користувача
- картинка, кількість учасників, кількість коментарів, статус

## 8. UI-особливості в оновленому архіві

- таймер на картці показує залишок до `timer_deadline`
- фон таймера — напівпрозорий сірий
- якщо лишається менше 5 хвилин, текст таймера стає червоним
- статус змагання має колір:
  - `active` → зелений (`Online`)
  - `finished` → червоний
  - `judging` → фіолетовий
  - `archived` → сірий
  - `registration_open` → оранжевий
  - `upcoming` → синій
- `Last Competitions` показується як вертикальний список вузьких банерів

## 9. Подальші кроки

- auth/me
- save/unsave
- watch list
- websocket live timer
- детальна сторінка турніру
- пагінація

### Live streams and realtime demo rounds

A stream is configured per round, not only per competition. For a real integrated player, use the provider's iframe/embed URL in `stream_embed_url` and keep the public watch URL in `stream_url`. If only `stream_url` is filled, the competition page shows an external link instead of an iframe. This is enough for YouTube/Vimeo/Twitch-style streams when the provider allows embedding; direct HLS/WebRTC integration would need a dedicated player component.

After pulling this version run:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_landing
```
