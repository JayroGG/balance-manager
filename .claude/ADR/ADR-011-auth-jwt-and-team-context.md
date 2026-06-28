# ADR-011 — Auth via the backend's email/password JWT, and a client-side team context

- **Status:** Accepted
- **Date:** 2026-06-28
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** **Supersedes ADR-001** (auth strategy). Builds on ADR-003 (managed-first),
  ADR-005 (RTK Query), ADR-006 (secure-store), ADR-008 (thin routes). Mirrors the backend's
  teams-and-auth update.

## Context

The `balance` backend shipped two breaking changes:

1. **Auth is now real and required.** Every request needs `Authorization: Bearer <token>`. Login is
   **email/password → JWT** (`POST /auth/login` → `{ token }`, 7-day expiry; `POST /auth/logout` for a
   real per-device revoke; a `401` on any call means the session is over). This is **our own backend's
   JWT — not Auth0.**
2. **A team context.** `transactions`, `vaults`, `categories`, and `balance` are now either **personal**
   (no param) or **team** (`?team_id=T`). Response shapes are unchanged (rows merely gained a `team_id`
   field). `team_id` travels in the **query string only — never in a request body**; the server injects
   it on writes.

ADR-001 anticipated real auth but assumed it would be **Auth0**, and noted that adopting `react-native-auth0`
would force leaving Expo Go for a dev build (ADR-003). That assumption no longer holds: the backend's own
JWT needs nothing but `fetch` + secure-store, both already in the app. So real auth ships **inside Expo Go,
with no prebuild** — and the seam ADR-001 built (one token-injection point) is exactly what we fill in.

## Decision

### Auth = the backend's email/password JWT, through the existing seam

- **The seam is unchanged.** The only place a token is attached to a request stays
  `src/services/api/baseApi.js` `prepareHeaders`, reading the `auth` slice. Login/logout just populate
  and clear that slice (and `expo-secure-store`). No screen, hook, or endpoint reads the token elsewhere.
- **Login:** a real `src/screens/Login` (email + password) calls a `login` mutation
  (`POST /auth/login`); on success the JWT is written to secure-store **and** the `auth` slice. A bad
  password returns `401` on `/auth/login` — which is **exempt** from the auto-logout below — and is shown
  as an inline "Invalid credentials" message.
- **Logout:** Settings calls `POST /auth/logout` (best-effort revoke), then clears the token (slice +
  secure-store), resets the team context, and purges the cached financial data.
- **401 = session over:** in `baseQueryWithErrorShape`, a `401` on **any endpoint except `login`** clears
  the `auth` slice + secure-store and dispatches `baseApi.util.resetApiState()` (using `util`, not
  `persistor`, to avoid a circular import). A runtime guard in `app/(tabs)/_layout.jsx` then redirects to
  `/(auth)/login`; cold start is still handled by `app/index.jsx`.
- **Ships in Expo Go.** No native module, no prebuild — this **explicitly corrects ADR-001's "auth ⇒ dev
  build" note**, which applied only to the now-dropped Auth0 path. Framed as the resumption of the
  always-intended own-backend path (consistent with ADR-003 managed-first). **Auth0 is dropped.**
- **Bypass is dev-only.** `AUTH_BYPASS` is honored **only when `ENV === 'dev'`** (hardened in
  `src/utils/config.js`), so a misconfigured stage/prod env file can never skip real login.

### Team context = one client slice, threaded as a query param

- A single `context` slice holds `{ activeTeamId }` (`null` = personal). It is **persisted** (non-secret)
  and **reset on logout**.
- `team_id` is appended to each entity endpoint's URL as `?team_id=` via a small `withTeam(path, team_id)`
  helper, and is carried as part of the **RTK Query arg** — so it becomes part of the cache key. Personal
  and team data are therefore cached **separately** and refetch automatically on a context switch.
- On writes, `team_id` is destructured **out of the body** and placed in the URL only (the server injects
  it). It is **never** a body field.
- **The UI is reused for both contexts.** The only new control is a **Personal/Team switch on the
  Dashboard** (chips populated from a read-only `GET /teams`). Every entity screen reads
  `selectActiveTeamId` and threads it into its hooks/mutations.

### North star / deferred (recorded explicitly)

Full **team management** — create / rename / delete a team, add / remove members (the backend's new Teams
write API) — and **per-context RBAC** are deferred to a later phase. Only **read-only `GET /teams`** is
wired now, to populate the switch. No team-CRUD UI ships in this phase.

## Consequences

- **Positive:** real, revocable auth with zero new native dependencies — still Expo-Go-safe. The seam
  built in ADR-001 paid off: the data layer didn't change for auth.
- **Positive:** personal/team isolation falls out of the RTK Query cache key for free; switching context
  shows cached data instantly, then revalidates.
- **Positive:** the dev bypass is now structurally impossible outside dev, removing ADR-001's foot-gun.
- **Negative / trade-offs:** `team_id` must be threaded through every entity hook/mutation call site (a
  one-line change per call, centralized through `withTeam` on the endpoint side). Single-item GETs gained
  an object arg (`{ id, team_id }`).
- **Follow-ups:** when team management starts, add the Teams write endpoints + screens and a superseding
  (or extending) ADR; revisit RBAC gating then.

## Alternatives considered

- **Keep Auth0 as the target (ADR-001).** Rejected: the backend ships its own JWT, so Auth0 would add an
  external dependency, cost, and a forced dev build for no benefit.
- **Put `team_id` in mutation bodies.** Rejected: the backend contract is explicit — query string only;
  the server injects it on writes. Bodies stay context-free.
- **One global "current team" baked into `prepareHeaders` (e.g. an `X-Team-Id` header).** Rejected: it
  would not participate in the RTK Query cache key, so personal/team caches would collide and stale across
  switches. The query-arg approach keeps them isolated.
- **Separate team-scoped screens.** Rejected: doubles the UI. Reusing the same screens with a context
  switch is the whole point.
