# Нотатки з безпеки

## Production секрети

- `SECRET_KEY` має бути унікальним для production.
- `DEBUG=0` обов'язковий у production.
- Локальні `.env` файли не можна комітити.
- Startup scripts не повинні створювати default admin users або парольні demo accounts у production.

## Авторизація та сесії

- Auth API має використовувати CSRF protection для state-changing requests.
- Frontend повинен отримувати CSRF token перед login/register/logout та не зберігати некоректні token values.
- Після зміни активного акаунта UI має повністю оновлювати рольові дії, saved state та profile context.
- Паролі не мають логуватися або зберігатися у localStorage.

## Файли

- Файлові байти зберігаються на сервері або в object storage, база містить лише metadata.
- Backend перевіряє максимальний розмір файлу.
- Downloads приватних матеріалів проходять через permission checks.
- Production потребує antivirus/malware scanning або provider-level scanning перед публічним доступом до файлу.

## CORS та CSRF

Production deployment повинен явно задавати:

```env
ALLOWED_HOSTS=olympiad-api.onrender.com
CORS_ALLOWED_ORIGINS=https://olympiad-landing.onrender.com
CSRF_TRUSTED_ORIGINS=https://olympiad-landing.onrender.com
SECURE_SSL_REDIRECT=1
```

## Майбутні посилення

- Rate limiting для auth, registration, comments, uploads.
- Audit log для admin/organizer actions.
- SAST та dependency scanning у CI.
- Security headers regression checks.
- Ротація secrets і documented incident response.
