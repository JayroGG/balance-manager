# Backend contract — Auth & Team context

> **Repo-local reference for `balance-mobile`.** Reconstructed from the decisions in
> `.claude/agents/plans/002-auth-and-team-context.md` and ADR-011, **not copied** from the backend brief
> (which lives on the backend repo at `…/balance/docs/react-native-teams-and-auth-update.md`). Reconcile
> against that brief when wiring against a live backend; if anything here disagrees with the running API,
> the API wins — update this doc.

This documents only what the **client** consumes for the auth + team-context update. The full entity
contract (transactions / categories / vaults / balance shapes) stays in `PRD.md` §4.

## Authentication

Every request carries `Authorization: Bearer <token>`. The token is the backend's own JWT — **not Auth0**.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `200 { token }` | 7-day JWT. `401` = bad credentials (shown inline; does **not** log the user out). |
| POST | `/auth/logout` | — | `204` | Per-device revoke. Best-effort on the client — clear locally regardless of the result. |

**The `401` rule:** a `401` on **any endpoint except `/auth/login`** means the session is over. The client
clears the token (auth slice + secure-store), drops cached financial data, and routes to login. `/auth/login`
is exempt so a wrong password surfaces as an inline error instead of bouncing the screen.

**Always send the token.** The single injection point is `src/services/api/baseApi.js` `prepareHeaders`
(ADR-011). No screen, hook, or endpoint attaches the token any other way.

**Bypass is dev-only.** `AUTH_BYPASS=true` skips login and sends a placeholder token (the backend ignores
it) **only when `ENV === 'dev'`**. Stage and prod always require real login (`src/utils/config.js`).

## Team context

`transactions`, `vaults`, `categories`, and `balance` are scoped by an optional **`team_id`** query param:

| Context | Request | Meaning |
|---|---|---|
| Personal | `GET /balance` | the signed-in user's own data |
| Team | `GET /balance?team_id=42` | data for team `42` |

The same applies to `/transactions`, `/vaults`, `/categories` (and their sub-paths / actions). Response
shapes are **unchanged** — rows simply gained a `team_id` field.

### The two rules

1. **`team_id` goes in the query string — never in a request body.** On writes (POST/PUT/DELETE,
   allocate/withdraw) the client puts `team_id` in the URL and the **server injects it** onto the row. The
   client `withTeam(path, team_id)` helper centralizes the append; mutations destructure `team_id` out of
   the body.
2. **Omit it entirely for personal context.** `team_id == null` → no param.

Because `team_id` is part of the RTK Query **arg**, it's part of the cache key: personal and team data are
cached separately and refetch on a context switch.

### Error matrix (surface `error` as the user-facing message)

| Code | When |
|---|---|
| `400` | Validation (e.g. amount ≤ 0; allocate over `available`; withdraw over the vault balance; delete a non-empty vault). |
| `401` | Missing/expired/revoked token → session over (auto-logout, except on `/auth/login`). |
| `403` | Authenticated but not a member of the requested `team_id`. |
| `404` | Missing or soft-deleted resource (treat as gone). |

## Teams API

| Method | Path | Body | Returns | Status |
|---|---|---|---|---|
| GET | `/teams` | — | `200` array of `{ id, name, … }` | **Wired (read-only)** — populates the Dashboard switch. |
| POST / PUT / DELETE `/teams[/:id]`, member add/remove | — | — | — | **Not yet wired.** Team-management CRUD + RBAC are deferred (ADR-011). |
