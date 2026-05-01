# Judgify Landing

Demo landing page and competition details prototype for a competition platform.

## Project structure

```text
backend/   Django REST API
frontend/  React + Vite frontend
```

## Local development

```bash
docker compose up --build
```

Local URLs:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Django admin: http://localhost:8000/admin

Default local admin created by Docker command:

```text
admin / admin12345
```

## Render deployment

Use the Render Blueprint from `render.yaml`.

See detailed instructions in [`RENDER_DEPLOY.md`](./RENDER_DEPLOY.md).
