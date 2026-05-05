# Backend start fix

This version removes automatic `makemigrations` from `docker-compose.yml`.

Run:

```bash
docker compose down
docker compose up --build
```

If you copied this version over an older project folder and backend still reports conflicting migrations, remove stale generated migration files from:

```text
backend/landing/migrations/
```

Known stale files from previous iterations:

```text
0004_competition_access_mode_and_more.py
0004_alter_competitionparticipant_status.py
```

The intended migration chain in this archive is:

```text
0001_initial.py
0002_profile_data_model.py
0003_competition_teams_and_participation_status.py
0004_constructor_and_invitations.py
0005_language_and_recent_materials.py
```
