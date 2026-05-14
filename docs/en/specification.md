# Judgify Specification

This document describes Judgify as if the product had been built through
spec-driven development. It is the canonical product and engineering
specification for the tournament platform, complementing
`docs/en/overview.md`, `docs/en/data-model.md`, `docs/en/security.md`, and
the Django migrations.

## 1. Product Scope

Judgify is a web platform for creating, running, judging, and publishing
tournament-style competitions. The product supports public discovery,
registration workflows, team and individual participation, multi-round
submissions, manual and automated judging, peer review, leaderboards, awards,
profile dashboards, and administrative operations.

The current deployment target is Render:

- `olympiad-api`: Django REST API.
- `olympiad-landing`: React/Vite frontend.
- `olympiad-db`: PostgreSQL database.

The demo environment intentionally contains seeded competitions covering the
major product scenarios: registration, active rounds, judging, finished events,
archived references, teams, individual participants, scores, materials, awards,
certificates, announcements, comments, saved competitions, and admin queues.

## 2. Roles And Permissions

### 2.1 Platform Roles

The platform defines four account-level roles:

- `participant`: can register for competitions, join teams, submit work, take
  part in peer review when enabled, view own results, save competitions, and
  manage profile materials.
- `organizer`: can create competitions, edit competitions they organize, manage
  rounds, deadlines, criteria, awards, materials, announcements, join requests,
  teams, judge assignments, and competition-level auto-approval.
- `viewer`: can browse public information, save competitions, view public
  results according to visibility policy, and comment only where allowed.
- `admin`: can manage users, competitions, filters, platform settings, pending
  organizer proposals, and server/performance diagnostics.

### 2.2 Competition-Scoped Roles

Judging is a competition-scoped responsibility, not a separate account role.
A judge is a normal user, represented in the competition by:

- a `CompetitionParticipant` record with `role = judge`;
- a `CompetitionJudgeAssignment` record for manual judging.

Rules:

- A judge cannot participate in the same competition as a participant or team
  member.
- A participant/team member cannot be assigned as a judge in the same
  competition.
- An organizer can edit only competitions they organize.
- An admin can edit all competitions.
- The UI must recalculate available actions immediately when the active account
  changes.

### 2.3 Permission Matrix

| Action | Viewer | Participant | Organizer | Admin | Judge |
| --- | --- | --- | --- | --- | --- |
| Browse public landing | Yes | Yes | Yes | Yes | Yes |
| Save competition | Auth only | Yes | Yes | Yes | Yes |
| Join competition | No | Yes | No | No | No |
| Submit work | No | Approved only | No | No | No |
| Edit own competition | No | No | Yes | Yes | No |
| Edit any competition | No | No | No | Yes | No |
| Review join requests | No | No | Own competitions | All | No |
| Accept judge invitation | No | If invited and not participant | If invited and not organizer conflict | Yes | Yes |
| Score work manually | No | No | Own competitions | Yes | Assigned judges |
| Peer review | Configured only | Approved participants | No | Yes | No |
| View private judging details | No | Own allowed data | Own competitions | Yes | Assigned context |

## 3. Competition Lifecycle

### 3.1 Competition States

Supported competition states:

- `draft`: organizer draft, not visible in public catalog.
- `published`: published but not necessarily open or active.
- `upcoming`: future event or future registration.
- `registration_open`: registration is currently available.
- `active`: at least one competition round is active.
- `judging`: rounds are finished and judging window is open.
- `finished`: results are published or judging has ended.
- `archived`: historical competition; no join or submit actions.

Status must be derived from date fields and explicit archive/draft choices. The
system must not rely solely on stale persisted status values for public cards.
Landing endpoints recompute timing before returning cards.

### 3.2 Date Rules

- If `starts_at` is missing, publishing can start the competition.
- Registration can be modeled with `registration_starts_at` and
  `registration_ends_at`.
- Judging can be modeled with `judging_starts_at`, `judging_ends_at`, and
  `results_public_at`.
- Editing active competitions is allowed, but critical date changes must be
  validated.
- The next round must not start before the previous round ends.
- If a following round has no start date, default it to previous round end plus
  one second.

### 3.3 Round States

Supported round states:

- `draft`
- `scheduled`
- `active`
- `closed`
- `judged`

Rules:

- Rounds transition automatically based on their start/end dates.
- A later round cannot become active while an earlier round is unfinished.
- Submissions are allowed only during active rounds where
  `submission_required = true`.
- After a round deadline, related submissions must become locked.

## 4. Registration And Participation

### 4.1 Join Request States

Join request states:

- `pending`
- `approved`
- `rejected`
- `withdrawn`

Rules:

- A join request is not automatic participation unless competition access mode
  or auto-approval allows it.
- Pending requests must not be counted as real participants.
- The public participant count and the `Participants` tab must show approved
  participants/team members only.
- Repeated Join must not create duplicate requests.
- User context must survive sign-in/sign-up and return to the same competition.

### 4.2 Access Modes

Supported competition access modes:

- `open`: Join creates an approved membership immediately.
- `application`: Join creates a pending request.
- `invite_only`: participation requires an invitation.

The organizer can enable competition-level auto-approval. The admin can enable
global auto-approval for organizer-created competition proposals.

### 4.3 Participant Presence

Presence is competition-scoped and represented by `is_active_now` on
`CompetitionParticipant`.

Rules:

- Seeded/demo participants may be marked active to demonstrate presence.
- The current authenticated approved user is treated as active for their own
  membership in serialized participant/team views.
- Presence should not be used as an authorization source.
- Presence must remain consistent between participant list rows and team member
  rows.

## 5. Teams

Teams are represented by `CompetitionTeam` and linked `CompetitionParticipant`
records.

Rules:

- A participant can belong to multiple teams across different competitions.
- A participant cannot be in multiple teams within the same competition.
- A team must have at least one member.
- A team has exactly one captain when possible.
- The captain can manage membership and transfer captain role.
- A team can submit work as a single competition subject.
- A judge cannot be a member of a team in the same competition.

Team states:

- `draft`
- `pending`
- `approved`
- `rejected`
- `archived`

## 6. Submissions And Materials

### 6.1 Submission Model

A submission is attached to:

- a competition;
- a round;
- either a participant or a team;
- a submitter user;
- optional file/material metadata.

Submission statuses:

- `created`
- `validated`
- `accepted`
- `rejected`
- `locked`

### 6.2 Submission Policies

Supported policies:

- `single`: one submission only.
- `latest`: one logical submission where updates replace the prior state.
- `multiple`: multiple submissions allowed up to the configured maximum.

Rules:

- Approved participants can submit only during allowed active round windows.
- The UI must show `Submitted` after successful submission.
- Before the deadline, updates are allowed when policy permits.
- After the deadline, submission is locked.
- Duplicate submissions must not be created for `single`/`latest` policies.

### 6.3 Material Types

Supported material types:

- files;
- links;
- videos/streams;
- repositories;
- generated demo artifacts.

Rules:

- Production file bytes should be stored in object storage or server media
  storage.
- Database rows store metadata only: name, MIME type, size, storage key,
  checksum, visibility, owner, and file type.
- Maximum file size is set by the organizer and enforced on the backend.
- Download access must go through backend permission checks for private or
  competition-only materials.

## 7. Judging

Judging is the most important workflow and must support three modes:

- `automatic`: system-generated or imported scores.
- `manual`: invited judges score submitted work.
- `peer_review`: approved participants review other participants' submissions
  when enabled.

### 7.1 Judging Configuration

Competition-level flags:

- `manual_judging_enabled`
- `automatic_judging_enabled`
- `peer_review_enabled`
- `judging_aggregation`
- `judging_visibility`
- `results_frozen`

Aggregation modes:

- `average`: average multiple scores per criterion before weighting.
- `sum`: sum multiple scores per criterion before weighting.

Visibility modes:

- `aggregate`: show aggregate scores only.
- `open`: show judge-level details.
- `anonymous`: hide judge identities while preserving details as allowed.

The demo seed must include competitions covering both `average` and `sum`
aggregation and all judging modes.

### 7.2 Criteria

A criterion contains:

- title;
- description;
- max score;
- weight;
- judging mode;
- sort order.

Rules:

- Criterion descriptions can be long and must not overcrowd score tables.
- UI should show criterion title in tables and open a modal for description,
  max score, weight, and judging mode.
- Criteria with existing scores cannot have scoring-critical fields changed
  without validation.
- Weight contributes to total score calculation.

### 7.3 Scoring Subject

Judging rows must be grouped by logical competition subject:

- `team-{id}` for team competitions;
- `participant-{id}` for individual competitions;
- `submission-{id}` only as fallback when no participant/team subject exists.

The submission remains the evidence/material linked to the subject. Tables must
not accidentally show multiple rows for the same team/participant when the
logical row is intended to be the team or participant.

### 7.4 Manual Judging Workflow

Scenario:

1. Organizer invites a user as judge for a competition or round.
2. Judge accepts or declines.
3. Accepted judge opens the `Judging` tab.
4. Judge sees eligible teams/participants and their submitted materials.
5. Judge selects round, subject, and allowed review mode.
6. Scorecard shows only criteria applicable to that review mode.
7. Judge saves draft scores or finalizes.
8. Re-saving updates existing scores instead of creating duplicates.
9. Judge can edit own scores until judging deadline, unless results are frozen.

### 7.5 Peer Review Workflow

Scenario:

1. Competition enables peer review.
2. Approved participants see peer-review mode during judging window.
3. Participant cannot review their own individual/team subject.
4. Peer review creates scores linked to the peer reviewer, criterion, round,
   subject, and review type.
5. Peer review aggregation follows competition aggregation mode.

### 7.6 Automatic Judging Workflow

Scenario:

1. Competition enables automatic judging.
2. Automatic criteria are seeded/imported from system checks.
3. Scores use `review_type = automatic`.
4. Automatic scores can have `judge = null`.
5. Automatic results appear in aggregate judging tables and leaderboards.

## 8. Results And Leaderboards

### 8.1 Round Scores

Round score tables must show:

- round title and state;
- team/participant subject;
- criterion score values;
- max score per criterion;
- criterion modal details;
- score counts where relevant.

The judging table may omit the total score column when it makes the review UI
too crowded. Results pages can show aggregate totals.

### 8.2 Leaderboard

Leaderboard rules:

- Leaderboard is calculated from aggregate round scores.
- Scores are grouped by team or individual participant.
- All scored rounds can contribute.
- Sorting is descending by score, then by name.
- Public display shows top 10.
- Organizer/admin can preview results before public release.
- Results can be frozen by organizer/admin.
- Archived competitions do not show Join or Submit.

### 8.3 Result Visibility

- Participants see their own data.
- Organizers and admins see full competition results.
- Public users see results only when public visibility allows it.
- Open judging mode can show judge-level details.
- Anonymous/aggregate modes must hide identity-sensitive details.

## 9. Landing Page

### 9.1 Catalog Tabs

Landing tabs are status-based:

- Registration open
- Active
- Judging
- Upcoming
- Finished
- Archived

Rules:

- Archived competitions must not mix with active/current tabs.
- Each card shows the nearest meaningful timer unless archived.
- If a timer deadline is within five minutes, the timer is visually emphasized.
- Cards must move between tabs as timers/statuses change.
- The landing grid supports pagination with a shared design.

### 9.2 Filters

Filters are admin-configurable. Supported filter groups:

- event type;
- participation type;
- industry;
- difficulty;
- language;
- access mode.

Admins may add, edit, hide, sort, and localize filter values. Filter values
should not be physically deleted from configuration when hiding is sufficient
for catalog adaptation.

## 10. Profiles And Account Switching

Profile dashboards show role-specific data.

Participant profile should include:

- active competitions;
- archived competitions;
- teams;
- saved competitions;
- pending applications;
- badges;
- certificates;
- personal materials;
- recent notifications;
- own comments where relevant.

Organizer profile should include:

- drafts;
- organized competitions;
- pending join requests;
- judging assignments if applicable;
- notifications;
- comments and announcements relevant to their competitions.

Admin profile should include:

- admin panel entry;
- pending organizer proposals;
- platform/server insights;
- user/competition management context.

Rules:

- Sections must not be duplicated.
- Viewer accounts show saved competitions and public activity but not organizer
  or participant-only controls.
- Account switching must immediately refresh actions, saved state, landing
  access controls, and profile sections.
- Local storage must not mix saved/profile state between users.

## 11. Announcements And Comments

Announcements are a competition communication channel.

Rules:

- Organizer can create announcements from the competition overview/editor.
- Participants can see announcements on the competition page.
- Comments are allowed only where competition policy and backend permissions
  allow them.
- Organizer can edit/delete their own announcements.
- Normal participants cannot edit organizer announcements.
- Comments authored by a user should be visible from that user's profile where
  profile dashboard includes comment history.

## 12. Admin Panel

Admin panel capabilities:

- manage accounts;
- manage competitions;
- manage landing filters;
- configure platform auto-approval;
- inspect server/runtime metrics.

Admin tables must support:

- search/filter controls;
- pagination with shared design;
- responsive overflow behavior;
- delete actions where allowed;
- backend validation for every write action.

Mailing/broadcast functionality is intentionally excluded from the current
admin panel until competition chat/notification workflows are fully specified.

## 13. Security And Authentication

Rules:

- Django session cookies are the source of authentication truth.
- Unsafe requests use CSRF protection.
- Frontend uses `credentials: "include"`.
- Passwords, sessions, tokens, and role grants must not be stored in
  `localStorage`.
- Browser password leak warnings are mitigated by encouraging strong unique
  passwords and by never reusing demo credentials for production accounts.
- Hidden frontend buttons are not authorization. Backend endpoints must enforce
  role and ownership checks.
- Production must run with `DEBUG=0` and a unique `SECRET_KEY`.

## 14. Localization

The product supports at least:

- English (`en`);
- Ukrainian (`uk`).

Rules:

- Language selector appears in the header near auth/profile controls.
- Account-level language preference should persist when supported by backend
  profile storage.
- Filters, tabs, statuses, forms, descriptions, buttons, admin labels,
  judging labels, pagination, and empty states must be localized.
- UI must tolerate missing translations with safe default values.

## 15. Pagination

Long list surfaces use shared pagination controls:

- landing competition grid;
- latest competitions block;
- admin users table;
- admin competitions table;
- admin filter table;
- competition participants list.

Rules:

- Pagination resets to page 1 when filters/search/status context changes.
- Controls show visible range, current page, total pages, previous, and next.
- The design must be consistent across cards and tables.
- Mobile controls stack vertically and avoid text overlap.

## 16. Demo Data Requirements

The demo seed must stay idempotent and safe to run on startup.

Required demo coverage:

- registration-open competitions with pending and approved applications;
- active competitions with multiple rounds and submissions;
- judging competitions with finished rounds and open judging windows;
- finished competitions with visible results;
- archived competitions without Join/Submit;
- team competitions;
- individual competitions;
- manual judging;
- automatic judging;
- peer review;
- `average` aggregation;
- `sum` aggregation;
- public and aggregate/anonymous visibility examples;
- downloadable local demo files instead of placeholders;
- announcements and comments;
- badges and certificates;
- saved and recently viewed competitions;
- admin pending queues;
- organizer and admin auto-approval examples.

Validation command:

```bash
cd backend
python manage.py validate_demo_integrity --warnings-as-errors
```

## 17. API Contracts

Important API surfaces:

- `GET /api/landing/competitions/`
- `GET /api/landing/sidebar/`
- `GET /api/competitions/{id}/`
- `GET /api/competitions/{id}/participants/`
- `POST /api/competitions/{id}/join/`
- `GET /api/competitions/{id}/judging/`
- `POST /api/competitions/{id}/judging/`
- `GET /api/competitions/{id}/results/`
- `GET /api/me/profile-dashboard/`
- `PATCH /api/me/profile-dashboard/`
- admin endpoints under `/api/admin/...`

API response requirements:

- Competition cards include computed status, timers, participant count, saved
  state, join/edit/judge/submit affordance hints, and user participation state.
- Participant endpoint returns approved participants/team members only.
- Judging endpoint returns criteria, submissions/materials, round score tables,
  review modes, aggregation mode, visibility mode, judge workspace, and metrics.
- Results endpoint returns leaderboard, round history, and round score tables
  based on permissions and visibility.

## 18. Acceptance Criteria

The following commands must pass before shipping behavior changes:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py validate_demo_integrity --warnings-as-errors
```

```bash
cd frontend
npm run build
```

Behavioral smoke checks should confirm:

- landing tabs contain expected status-specific competitions;
- participant card count equals approved participants tab count;
- judging tab contains competitions in `judging`;
- judging rows are grouped by team/participant, not by submission where a
  subject exists;
- both `average` and `sum` aggregation exist in seeded data;
- Join does not duplicate pending requests;
- account switching changes available actions immediately;
- archived competitions show no Join or Submit action.

## 19. Architecture Quality Assessment

Current strengths:

- Clear separation between React frontend, Django REST API, and PostgreSQL.
- Critical workflows are enforced through backend permissions instead of only
  frontend state.
- The core domain is normalized across competitions, rounds, participants,
  teams, submissions, judging, awards, profile dashboards, saved items,
  announcements, and comments.
- Demo data is seeded through an idempotent command and backed by an integrity
  validation command.
- Render Blueprint keeps deployment topology reproducible.

Current risks and architectural pressure points:

- Some high-volume lists still depend on frontend pagination, which is useful
  for UX but not sufficient as data grows.
- Real-time timers and presence currently do not have a dedicated WebSocket or
  Server-Sent Events layer.
- Production-grade file handling needs object storage, malware scanning, and
  signed download URLs as a standard path rather than an optional extension.
- Outbound messages are persisted but do not yet have a worker/provider
  integration for reliable delivery.
- Admin and organizer actions need a fuller audit trail.
- Automated coverage must be broadened for role conflicts, date transitions,
  judging idempotency, leaderboard aggregation, and demo seed integrity.
- Observability and SLOs are not yet formalized enough for a mature production
  service.

## 20. Future Software Quality Needs

Quality assurance should become a dedicated engineering stream with explicit
release gates:

- Unit tests for domain rules: lifecycle statuses, deadline validation,
  role-based permissions, judging modes, aggregation, and archived behavior.
- Integration tests for API flows: Join, Submit, Judge, Results, Saved,
  Profile, Admin, comments, announcements, and file uploads.
- Browser E2E tests for anonymous-to-authenticated join flow, competition
  builder, active editing, judging workspace, results publication, account
  switching, and profile notifications.
- OpenAPI/schema generation and contract tests between frontend and backend.
- Regression checks for `seed_landing_if_empty` and
  `validate_demo_integrity --warnings-as-errors`.
- Table-driven or property-based tests for time/status transitions.
- Visual regression for landing tabs/cards, profile popover, builder,
  judging tables, modal criteria details, admin tables, and responsive layouts.
- Accessibility checks for keyboard navigation, focus management, contrast,
  form labels, tab panels, and modals.
- i18n completeness checks for English and Ukrainian strings.
- Performance budgets for landing, competition detail, profile dashboard, and
  admin tables.
- Load tests for landing APIs, participant lists, judging saves, comments, and
  file uploads.
- Security checks: dependency scanning, SAST, CSRF regression, rate limiting,
  password policy verification, and file upload scanning.
- Migration tests covering forward migration, rollback strategy, and seed
  compatibility.
- Observability: structured logs, request metrics, traces, error tracking,
  health checks, and alert thresholds.
- Deployment quality gates: backend check, migration dry-run, frontend build,
  integrity validation, and smoke tests before promoting a release.

## 21. Non-Goals For Current Version

The current product does not guarantee:

- production-grade email delivery;
- real-time WebSocket presence;
- external payment flows;
- object-storage deployment by default;
- high-volume server-side pagination for every endpoint;
- complete audit log/history UI.

These are valid future extensions but should be specified separately before
implementation.

## 22. Change Management

When adding features:

1. Update this specification first or in the same commit.
2. Add/update backend validations and serializers.
3. Add/update frontend affordances and localization.
4. Add demo seed coverage when the scenario is user-visible.
5. Run integrity and build checks.
6. Record notable behavior changes in `docs/en/changelog.md` when appropriate.
