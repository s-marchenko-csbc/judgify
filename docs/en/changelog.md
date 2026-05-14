# Changelog

## Unreleased

+ Added:
- Bilingual documentation structure under `docs/en` and `docs/uk`.
- PlantUML architecture folder with C4 and sequence diagrams.
- Architecture quality assessment and future software quality needs in the product specification.

~ Changed:
- Moved root documentation into the dedicated `docs/` folder and kept the root README as a navigation entry point.

## v28.5.1

! Fixed:
- Fixed seed crash caused by stale participant variable names.
- Made demo certificates idempotent by using stable unique verification codes.
- Prevented duplicate certificate verification code errors during repeated container restarts.


## v28.5
+ Added:
- Profile logo link back to the landing page.
- Participant stat tiles now navigate to Pending and Archived tabs.
- Demo badges and certificates are generated for users in seed data.

~ Changed:
- Recently Viewed and Saved side-panel cards now share the same compact visual style.
- Account menu avatar fills the whole circular button when a user photo is available.

! Fixed:
- Competition chat/comment count in cards is computed from server-side announcement comments instead of relying on stale or random values.

# v28.4

+ Added:
- Team captain management: transfer captain rights and remove team members from participant profile.
- Non-demo accounts saved in the local authorized account switcher list.

~ Changed:
- Team registration flow keeps pending teams visible in “My teams” immediately after request submission.

! Fixed:
- Non-demo authorized users no longer disappear from the account switcher after testing role/account changes.

# Changelog

## [v28.3] - 2026-05-03

### Added
- [REGISTRATION] Added organizer/admin review endpoint for participant join requests with approve/reject actions.
- [PROFILE] Added collapsible Badges and Certificates sections that show the latest item and the full list on expansion.

### Changed
- [REGISTRATION] Participant join requests now remain `pending` until the organizer or administrator manually reviews them.
- [PROFILE] Simplified participant profile: removed duplicated Saved/Active presentation, replaced Awards with Participant stats, and kept registered/archived competitions as the main participant sections.
- [PROFILE] Badge and certificate counters are shown from backend counts, not frontend placeholders.

### Fixed
- [PROFILE] Removed duplicated Saved blocks from the profile page.

## [v28.2] - 2026-05-03

### Added
- [PROFILE] Participant overview now starts with competitions where the user is currently registered, then archived competitions, then teams and awards.
- [PROFILE] Added a role-aware Pending panel: organizers see registration requests, admins see competition creation requests, participants see their own pending applications.
- [DATA] Seeded demo teams, participant pending applications, organizer review requests and an admin-visible competition creation request.

### Changed
- [PROFILE] Removed the misleading use of recently viewed competitions under participant achievements.
- [DATA] Demo participant seed now matches the account switcher username `demo_participant`.

## [v28.1] - 2026-05-03

### Added
- [DATA] Added additional standard demo competitions that keep registration open for several hours after container restart, so participant registration can be tested immediately.

### Changed
- [DATA] All standard seeded competitions are now assigned to `demo_organizer`, allowing the demo organizer account to edit them.
- [DATA] Registration-open competitions keep future rounds scheduled after registration closes instead of being converted to active demo competitions during seeding.

## [v28.0] - 2026-05-03

### Changed
- [BASELINE] Started a clean v28 baseline instead of continuing the accumulated v25 changelog branch.
- [CONSTRUCTOR] Competition start time is optional: if it is empty during publication, the backend starts the competition at the publication moment.
- [ROUNDS] Empty round start times are derived sequentially at publication: first round starts with the competition, next rounds start after the previous round ends.

### Fixed
- [DETAIL] Removed hardcoded detail-page fallback materials, announcements, results and judging metrics; detail data now comes from API endpoints or stays empty.
- [PROFILE] Removed fake profile competition cards, achievements, materials and hardcoded profile statistics; profile panels now use dashboard data or empty states.
- [VALIDATION] Publish validation no longer blocks a competition only because `starts_at` was intentionally left empty.

## [v25] - 2026-05-03

### Fixed
- [BACKEND] Removed automatic `makemigrations` from Docker startup to prevent runtime creation of duplicate migration leaf nodes.
- [BACKEND] Kept startup flow to `migrate -> seed_landing -> runserver`, relying on committed migration files.
- [BACKEND] Confirmed constructor admin models are imported in `landing/admin.py`.

### Notes
- If updating an existing local folder, delete stale generated migration files such as `0004_competition_access_mode_and_more.py` before running containers.


All notable changes to the Judgify landing/profile/competition platform prototype are tracked here.

Format follows the practical parts of **Keep a Changelog**: `Added`, `Changed`, `Fixed`, `Removed`, `Notes`.

## [v24] - 2026-05-03

### Fixed
- [AUTH] Account switcher menu now renders through a portal above side panels, preventing it from appearing under `Recently Viewed`.
- [SIDEBAR] Recently Viewed is split into competition and material sections and is deduplicated on the frontend and backend response path.
- [CONSTRUCTOR] Draft creation is protected against React StrictMode/double-click duplicate POSTs, and untitled draft slugs are generated uniquely.
- [FILTERS] Language remains a first-class landing filter with checkbox-style filtering through the existing API query model.
- [HEADER] Search remains scoped to the landing route where query filtering is used.

## [v23] - 2026-05-03

### Added
- [DATA] Added competition language to the data model, serializers, constructor defaults, seed data and landing filters.
- [SIDEBAR] Added recently viewed competition materials/files to the sidebar history model and API.
- [API] Added a material view endpoint so downloaded/opened competition materials can be recorded in Recently Viewed.

### Changed
- [SIDEBAR] Renamed `Last Competitions` to `Recently Viewed` and unified its representation with competition/material records from the database.
- [HEADER] Search input is now rendered only where search is actually used, primarily on the landing page.

### Fixed
- [AUTH] Account switcher dropdown now stays above the right sidebar panels.
- [SIDEBAR] Recently viewed competitions are now read from unique account-specific view records instead of duplicate join rows.

## [v22] - 2026-05-03

### Changed
- [CONSTRUCTOR] Combined the former separate schedule and round setup concerns into a single `Schedule & Rounds` step so each round has its own start/end window in the same place as the global competition dates.
- [BACKEND] Added schedule synchronization for published competitions: status, registration/submission flags, active round, timer deadline and trending score are recalculated from dates and round windows.
- [LANDING] Added a dedicated `Active competitions` tab and refined tab behavior: Trending is ranked by participants/views/followers/comments, New prioritizes upcoming and recently started competitions, and Finished & archived remains separate.
- [FILTERS] Reviewed status filtering so card lists and status filters use the same stored status values.

### Added
- [DATA] Added demo participant accounts distributed across multiple competitions, teams and statuses for profile/participant list testing.
- [DATA] Seeded round windows for demo competitions so timers and active round indicators are derived from real round dates.

## [v21] - 2026-05-02

### Fixed
- [UI] Unified the competition detail page with the blue/violet visual language used by landing and profile pages.
- [UI] Made tab panels compress labels to keep tabs in one row on narrower screens.
- [SIDEBAR] Made Last Competitions clickable and routed them to competition detail pages.
- [DATA] Added additional Upcoming demo competitions so the New tab shows upcoming items.
- [BRANDING] Replaced the placeholder header mark with a Judgify logo linked to the landing page.

## [v20] - 2026-05-02

### Fixed
- [AUTH] Saved competitions and recently viewed history now use account-specific identity keys instead of email-only local profile keys, so accounts with the same email stay separated.
- [PARTICIPATION] Organizer accounts and organizer memberships are no longer counted as competition participants.
- [LANDING] Removed the synthetic `Participating` card status; participating/pending cards keep their competition status and are highlighted with a light-red background instead.
- [LANDING] Removed the top `Active competitions` heading from the landing content area.
- [LANDING] Trending/New/Open Submission/Live Stream tabs no longer show finished or archived competitions.

### Added
- [LANDING] Added a dedicated `Finished & archived` tab for completed competitions.

## [v19] - 2026-05-02

### Fixed
- [CONSTRUCTOR] Published competitions are no longer shown in the organizer draft list after publication.
- [CONSTRUCTOR] Published public competitions are forced into catalog visibility and receive a timer deadline from registration/start/end dates.
- [CONSTRUCTOR] Normalized checkbox layout and sizing on the Content & Evaluation step.
- [PROFILE] Replaced the top logout shortcut with an account/profile control.

### Added
- [AUTH] Added Gmail-like account switcher with quick demo account switching and sign out.
- [AUTH] Added account menu access to Profile from the header and profile/constructor pages.

## [v18] - 2026-05-02

### Fixed
- [CONSTRUCTOR] Fixed draft creation failure caused by empty datetime strings being sent to Django DateTimeField fields.
- [CONSTRUCTOR] Step navigation now creates the initial draft with normalized nullable schedule fields.
- [API] Improved frontend error messages for validation responses without a `detail` field.

## [v17] - 2026-05-02

### Fixed
- [BACKEND] Fixed Django startup failure caused by missing admin imports for constructor models.
- [ADMIN] Registered competition constructor, invitation and outbound messaging models with explicit imports in `landing/admin.py`.

## [v16] - 2026-05-02

### Added
- [PROJECT] Added `docs/en/changelog.md` as the main change notes file for the project.
- [PROJECT] Added `VERSION` file to identify the current project package version.

### Changed
- [PROJECT] Established versioned release notes as a required artifact for future archive updates.

## [v15] - 2026-05-02

### Added
- [CONSTRUCTOR] Added 5-step competition constructor wizard: `Basics`, `Format & Access`, `Schedule`, `Content & Evaluation`, `Publish`.
- [CONSTRUCTOR] Added backend support for competition drafts as a single draft per competition instead of separate draft objects per step.
- [CONSTRUCTOR] Added access modes: `open`, `application`, `invite_only`.
- [CONSTRUCTOR] Added visibility/discovery modes: `public`, `unlisted`, `private`, catalog visibility and sharing settings.
- [CONSTRUCTOR] Added normalized settings for rounds, submissions, judging criteria and awards.
- [MESSAGING] Added invitation and outbound message infrastructure for future participant/team notifications.
- [PROFILE] Added navigation from organizer profile to competition constructor.

### Changed
- [FILTERS] Constructor fields were aligned with landing filters: category, tags, status, registration mode, access mode and visibility.
- [COMPETITION] Competition setup flow now produces data for cards, filters, profile sections and publication state from one model.

## [v14] - 2026-05-02

### Added
- [PARTICIPATION] Added participation states: `pending`, `approved`, `rejected`, `withdrawn`.
- [TEAMS] Added team participation model through `CompetitionTeam`.
- [PROFILE] Added `Pending` tab for applications awaiting review.
- [PROFILE] Added quick access to team and team members from profile.

### Changed
- [PARTICIPATION] Join action now creates a pending application when approval is required.
- [PARTICIPATION] Join button is disabled or relabeled when the user already participates or has a pending request.
- [TEAMS] Team name is included in the join workflow.

## [v13] - 2026-05-02

### Added
- [DATA_MODEL] Added backend profile data model: profile, files, badges, certificates, materials and recently viewed competitions.
- [COMPETITION] Added `draft` competition status.
- [API] Added `/me/profile-dashboard/` endpoint.
- [DOCS] Added `docs/en/data-model.md` with large-file storage notes.

### Changed
- [PROFILE] Profile dashboard now uses backend-shaped data for saved, recently viewed, archived and draft competitions.
- [DATA_MODEL] Saved, recently viewed, archived and active competitions were aligned with a single database-oriented model.

## [v12] - 2026-05-02

### Changed
- [PROFILE] Profile competition cards now use the same `CompetitionCard` component as the landing page.
- [PROFILE] Saved competitions in profile were aligned with the landing right sidebar.
- [PROFILE] Recently viewed competitions were restyled to match landing competition presentation.

### Fixed
- [SAVED] Favorite heart state was synchronized between profile cards, saved lists and landing lists.

## [v11] - 2026-05-02

### Fixed
- [PROFILE] Fixed `React is not defined` issue in `ProfilePage.jsx`.
- [NAVIGATION] Kept direct profile navigation through user icon.

## [v10] - 2026-05-02

### Fixed
- [PROFILE] Fixed white-screen behavior caused by profile authorization/rendering checks.
- [NAVIGATION] User icon now opens the profile directly.

### Removed
- [NAVIGATION] Removed separate `Profile` item from the user dropdown/menu flow.

## [v9] - 2026-05-02

### Added
- [PROFILE] Added full profile dashboard page.
- [PROFILE] Added role-based sections for `Organizer`, `Participant` and `Viewer`.
- [PROFILE] Added profile tabs: `Overview`, `Saved`, `Archived`, `Drafts`.
- [ORGANIZER] Added competition creation section for organizer profile.
- [PARTICIPANT] Added awards, materials and certificates/profile resources sections.
- [VIEWER] Added recently viewed section.

### Changed
- [UI] Profile styling was adapted to the provided schematic layout and blue-violet palette.

## [v8] - 2026-05-02

### Changed
- [AUTH] Registration panel was restyled according to the provided role-selection reference.
- [AUTH] Registration roles were changed to `Organizer`, `Participant`, `Viewer`.

### Removed
- [AUTH] `Administrator` was removed from registration and kept only for authorization/admin access scenarios.

## [v7] - 2026-05-02

### Added
- [AUTH] Added sign-in modal.
- [AUTH] Added demo login scenario for organizer/admin testing.
- [PROFILE] Added first profile page scaffold.
- [PROFILE] Added editable profile fields: role, interests, skills, organization and links.
- [ORGANIZER] Added first organizer-space placeholder for future admin/competition configuration.

### Changed
- [UI] Profile and login-related UI were adapted to the blue-violet style direction.

## [v6] - 2026-05-02

### Fixed
- [SAVED] Synchronized favorite hearts between competition cards, tabs and saved sidebar.
- [SAVED] Added removal from saved items directly from the right sidebar.

### Changed
- [UI] Applied blue-violet styling based on the provided visual references.

## [v5] - 2026-05-02

### Added
- [SECURITY] Added session-oriented security notes and local-development guidance.
- [AUTH] Prepared project for secure session-based authentication flow.

### Changed
- [PROJECT] Prepared the project for local Docker Compose usage after Render deployment was deferred.

## [v4] - 2026-05-02

### Added
- [ORGANIZER] Added early organizer/admin panel direction.
- [COMPETITION] Added competition configuration concept and monitoring/admin dashboard direction.

### Changed
- [UI] Landing state was adjusted for registered users and organizer workflows.

## [v3] - 2026-05-02

### Added
- [ROUTING] Added React Router based navigation foundation.
- [PROFILE] Added initial route/page navigation preparation.

### Fixed
- [FRONTEND] Addressed missing `react-router-dom` dependency/configuration issues in Docker-based frontend setup.

## [v2] - 2026-05-02

### Changed
- [LANDING] Simplified onboarding modal and reduced extra clickable elements.
- [LANDING] Added transition direction toward a basic profile page after onboarding.

### Fixed
- [UI] Adjusted modal styling consistency with the rest of the landing UI.

## [v1] - 2026-05-02

### Added
- [PROJECT] Initial Judgify landing prototype package.
- [LANDING] Competition card layout, status labels, timer strip and saved competition sidebar concept.
- [LANDING] Anonymous and registered landing states.
- [COMPETITION] Early competition card data model for category, status, image and saved state.


## v25 realtime rounds + streams fix

- Landing cards now poll the backend every 5 seconds so participants count, status, current round and timer deadline are refreshed without manual reload.
- Competition detail page also refreshes details and participants every 5 seconds.
- Round timing is returned in card/detail serializers and cards can derive the visible current round and deadline from the active round.
- Round configuration now supports optional video stream fields: `is_stream_enabled`, `stream_url`, `stream_embed_url`, `stream_label`.
- Overview tab renders the active round stream as an embedded iframe when `stream_embed_url` is provided, otherwise as an external stream link.
- Demo seed data creates short sequential rounds for visible competitions, with random switching over roughly two minutes for local testing.

## v25-splash-health-long-rounds
- App splash now polls `/api/health/` and stays visible until Django can access the database and demo competitions are seeded.
- Added backend health endpoint for frontend startup readiness checks.
- Seed data now keeps the first demo competitions on randomized short rounds inside a 3-minute window, while several standard competitions receive long active rounds so the Active section is not empty.
