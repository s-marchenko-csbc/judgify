# Нотатки щодо старту backend

Backend startup має бути коротким, детермінованим і безпечним для повторного запуску.

## Очікувана послідовність

1. Завантажити environment variables.
2. Перевірити production safety settings.
3. Виконати `python manage.py migrate --noinput`.
4. Якщо `SEED_DEMO_DATA=1`, виконати idempotent seed command.
5. Запустити Gunicorn на порту Render.

## Правила

- Startup не повинен видаляти користувацькі дані.
- Demo seed не повинен створювати дублікати.
- Production не має стартувати з development `SECRET_KEY`.
- Міграції мають бути backward-compatible для поточного production data.

## Діагностика

Якщо backend не стартує:

- перевірити Render logs;
- перевірити `DATABASE_URL`;
- перевірити `ALLOWED_HOSTS`, CORS та CSRF origins;
- локально виконати `python manage.py check`;
- перевірити, що migrations не очікують ручного втручання.
