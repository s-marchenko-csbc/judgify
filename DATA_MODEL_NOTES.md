# Judgify data model update

This version moves profile data from frontend-only state to a backend-centered model.

## Added/updated backend entities

- `UserProfile`: public profile data, role, bio, organization, skills, interests, avatar reference.
- `UserFile`: metadata for all user and competition files. The database stores only metadata and a storage key, not binary content.
- `RecentlyViewedCompetition`: normalized history of viewed competitions with `viewed_at` and `view_count`.
- `Badge` / `UserBadge`: badge catalog and awarded badges.
- `Certificate`: certificate metadata linked to a file and competition.
- `UserMaterial`: personal materials such as certificates, resources, submissions, notes and feedback.
- `Competition.status` now includes `draft` for organizer drafts.

## Profile API

`GET /api/me/profile-dashboard/` returns one aggregated profile payload:

- `user`
- `profile`
- `active_competitions`
- `saved_competitions`
- `recently_viewed`
- `archived_competitions`
- `draft_competitions`
- `badges`
- `certificates`
- `materials`
- `stats`

`PATCH /api/me/profile-dashboard/` updates profile fields.

## File storage strategy

Large files should not be stored in relational database rows. Store file bytes in object storage and keep only metadata in `UserFile`.

Recommended production options: Amazon S3, Cloudflare R2, Google Cloud Storage, Azure Blob Storage. For local development, use MinIO in Docker Compose or a mounted Docker volume.

Suggested `storage_key` format:

```text
users/{user_id}/avatars/{uuid}.webp
users/{user_id}/certificates/{uuid}.pdf
competitions/{competition_id}/attachments/{uuid}.zip
competitions/{competition_id}/submissions/{user_id}/{uuid}.zip
```

Private downloads should go through backend permission checks and short-lived signed URLs.

## Participation, approval and teams

Participation is modeled as a separate workflow rather than a local frontend flag. A user can have only one `CompetitionParticipant` record per competition. This prevents the UI from offering “Join competition” to a user who is already approved or whose request is still pending.

The workflow uses these states:

- `pending` — the user submitted a request and is waiting for organizer/admin approval;
- `approved` — the user is admitted and appears in active competition membership;
- `rejected` — the request was declined;
- `withdrawn` — the user left or cancelled the request.

Team participation is represented by `CompetitionTeam` and linked `CompetitionParticipant` records. A team has its own status (`draft`, `pending`, `approved`, `rejected`, `archived`) and a captain. Team members are still users, so profile dashboards can show quick access to teammates, their roles, statuses and the competition where the team participates.

The frontend should not infer participation from card lists. It should use API fields returned with each competition:

- `user_participation_status`;
- `user_participation_role`;
- `user_team`;
- `can_join`.

The Join button is enabled only when `can_join=true`. If the status is `pending`, the UI shows “Pending review”. If the status is `approved`, it shows “Already participating”.

## Competition constructor and distribution workflow

The constructor now uses one competition draft instead of one draft per step. A competition with `status = draft` stores `setup_step` and `completion_percent`, so the organizer can leave and continue the wizard without creating multiple partial draft entities.

The setup flow is intentionally limited to five decision-oriented steps:

1. `Basics` — title, descriptions, category/industry, difficulty, event type, cover and banner images. These fields are reused by landing cards and catalog filters.
2. `Format & Access` — `access_mode`, `participation_type`, team size constraints, visibility and discovery settings. These fields control Join behavior and direct catalog filtering.
3. `Schedule` — registration, competition, judging and results publication dates. These fields drive timers and automatic status transitions.
4. `Content & Evaluation` — rounds, submission settings, judging criteria and awards.
5. `Publish` — validation, preview and invitations/outbound messages.

### Access and registration modes

`access_mode` determines how participation is created:

- `open`: Join creates an approved participant/team-member record immediately.
- `application`: Join creates a pending request that organizer/admin must approve.
- `invite_only`: the competition is entered through invitation links; the default Join action is disabled for catalog users.

`visibility_mode` determines distribution:

- `public`: can appear in catalog when `show_in_catalog = true`.
- `unlisted`: accessible by direct link, not catalog discovery.
- `private`: organizer-controlled access only.

### Invitations and message queue

The backend includes `CompetitionInvitation` and `OutboundMessage`. The constructor can queue invitations for individual participants or team contacts. At this stage, messages are persisted with `status = queued`; a future worker or provider integration can send them through email, platform notifications or another channel.

This keeps email infrastructure out of the request-response path and avoids binding the competition model to a specific provider such as SMTP, SendGrid, SES or Mailgun.
