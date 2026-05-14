# Деплой Judgify на Render

Render deployment описано у `render.yaml`.

## Сервіси

- `olympiad-db`: PostgreSQL database.
- `olympiad-api`: Django API web service.
- `olympiad-landing`: static Vite frontend.

## Backend

Backend стартує командою:

```bash
bash ./start.sh
```

Startup flow:

1. застосувати міграції;
2. за потреби виконати idempotent demo seed;
3. запустити Gunicorn.

## Frontend

Frontend build має використовувати:

```env
VITE_API_BASE_URL=https://olympiad-api.onrender.com/api
```

## Обов'язкові production env vars

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

## Перевірка після деплою

- `/api/health/` повертає успішну відповідь.
- Landing page завантажує актуальні змагання.
- Auth flow отримує CSRF token і логіниться без 403.
- `validate_demo_integrity` проходить перед deploy або під час release-перевірки.
