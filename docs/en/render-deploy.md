# Deploy Judgify Landing to Render

This repository is a monorepo:

- `backend/` — Django REST API
- `frontend/` — React/Vite static frontend
- `render.yaml` — Render Blueprint for PostgreSQL + backend + frontend

## Recommended Render setup

Use **New → Blueprint** in Render and select this GitHub repository. Render will read `render.yaml` from the repository root and create:

1. `judgify-db` — PostgreSQL database
2. `judgify-api` — Django web service
3. `judgify-landing` — static React site

## Required production behavior

The backend runs:

```bash
./build.sh
python manage.py migrate

```

The frontend uses:

```bash
npm ci && npm run build
```

and publishes `frontend/dist`.

## Important notes

Do **not** run `makemigrations` on Render. Migration files must be generated locally and committed to GitHub.

Render must receive the API URL through the frontend env variable:

```bash
VITE_API_BASE_URL=https://judgify-api.onrender.com/api
```

React Router paths such as `/profile` and `/competitions/1` work because `render.yaml` includes the static site rewrite:

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

## Optional GitHub Actions deploy hooks

The workflow `.github/workflows/render-deploy.yml` can trigger Render deploy hooks after pushes to `main`.

Add these repository secrets in GitHub:

- `RENDER_API_DEPLOY_HOOK`
- `RENDER_FRONT_DEPLOY_HOOK`

They are available in Render service settings under **Deploy Hook**.

Render can also auto-deploy directly from GitHub without GitHub Actions. In that case, keep the workflow disabled or do not add the deploy hook secrets.

## Local development

Use Docker Compose:

```bash
docker compose up --build
```

The local frontend uses `http://localhost:8000/api` by default when `VITE_API_BASE_URL` is not set.

## One-time demo data on Render

Do not seed demo data on every deployment. If needed, run once from the Render shell:

```bash
python manage.py seed_landing
```
