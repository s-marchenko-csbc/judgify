# Security/auth notes for the local prototype

This version no longer treats `localStorage` as the source of truth for registration/authentication.

## Current approach

- Django session cookies are used for the demo user session.
- Frontend requests use `credentials: "include"`.
- Unsafe API methods (`POST`, `DELETE`, etc.) use `X-CSRFToken` from the `csrftoken` cookie.
- Saved competitions are stored in the backend through `UserSavedCompetition`.

## Auth endpoints

- `GET /api/auth/csrf/` — sets CSRF cookie.
- `GET /api/auth/me/` — returns current authenticated user.
- `POST /api/auth/dev-login/` — creates/uses a local demo user and opens a Django session.
- `POST /api/auth/logout/` — closes the session.

## Frontend storage policy

Do not store auth truth or tokens in `localStorage`.

Allowed for future use:

- UI preferences
- active tab
- non-sensitive filter state
- draft onboarding UI state

Do not store:

- passwords
- access/refresh tokens
- role grants
- real saved competitions state

## Next hardening steps

- Replace `dev-login` with real registration/sign-in forms.
- Add role checks for organizer/judge endpoints.
- Validate all write endpoints on the backend even if buttons are hidden in UI.
