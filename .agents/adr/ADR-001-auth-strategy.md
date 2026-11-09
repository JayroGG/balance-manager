# ADR-001 — Authentication as a modular client seam (bypass now, Auth0 + RBAC north star)

- **Status:** Superseded by [ADR-011](ADR-011-auth-jwt-and-team-context.md)
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Mirrors backend `balance` ADR-001; refines PRD §7 and PRD §9 Phase 2.
  Superseded by **ADR-011** — real auth is the backend's own email/password JWT (not Auth0), it ships in
  Expo Go with no dev build, and the bypass is now dev-only.

## Context

`balance-mobile` is the client for a single-user POC API. The backend currently injects a fixed
`req.userId = 1` and ignores the `Authorization` header (its own ADR-001). There is therefore no
real login to perform yet, but we must not scatter token/identity logic across screens and the data
layer — that would make the future Auth0 swap expensive. Same principle as the backend: aim high
(record the best-practice target), ship the leanest thing now, behind a seam that makes the upgrade
cheap.

## Decision

Treat authentication as a **single client-side boundary**: there is exactly **one place** that puts a
token on outgoing requests, and exactly **one place** that decides "logged in vs not" at boot.

- **Token injection (the seam):** RTK Query's `fetchBaseQuery.prepareHeaders` (in
  `src/services/api/baseApi.js`) reads the token from the `auth` slice and sets
  `Authorization: Bearer <token>`. **No screen, hook, or endpoint reads or sets the token any other
  way.** (`useIdToken()` is a thin read of the same source.)
- **Now (prototype):** `AUTH_BYPASS=true`. No login on the critical path — the app boots straight to
  the tabs and sends a **placeholder token** (the backend ignores it). The `auth` slice holds
  `{ token: <placeholder>, bypass: true }`.
- **North star (deferred, recorded now):** **Auth0** via `react-native-auth0` — hosted login, `idToken`
  as the Bearer token, `jwt-decode` for claims, and **roles & permissions (RBAC)** gating screens and
  actions. Enabling it touches only: the `auth` slice (real token + claims), a new `app/(auth)` login
  flow, and token persistence (already in `expo-secure-store`). The data layer and screens are untouched.
- **Guard:** `AUTH_BYPASS` must default to **off** outside development/stage builds (enforced where the
  flag is read in `src/utils/config.js` / the boot bootstrap).

> Note: adding `react-native-auth0` requires leaving Expo Go for a dev build — see ADR-003. That is a
> deliberate, recorded step for Phase 2, not the prototype.

## Consequences

- **Positive:** the prototype ships with zero auth friction; the upgrade path is "fill the `auth` slice
  from Auth0 + add a login route" — the data layer never changes.
- **Positive:** the "shoot high" target (Auth0 + RBAC) is on the record from the start.
- **Negative / trade-offs:** the bypass flag is a foot-gun if it ever ships enabled to prod — hence the
  default-off guard.
- **Follow-ups:** (1) implement the `auth` slice + placeholder token + bypass guard; (2) when Auth0 work
  starts, write a plan in `.claude/agents/plans/`, prebuild to a dev build (ADR-003), and add a
  superseding ADR if the seam contract changes.

## Alternatives considered

- **Adopt Auth0 now.** Rejected for the POC: external dependency, setup/cost, login UX overhead, and it
  forces a dev build immediately while the backend ignores tokens anyway. Kept as the north star.
- **Token read directly in each API module.** Rejected: scatters identity logic — the opposite of a seam.
- **Session cookies.** Rejected: the API is token/Bearer-oriented for a mobile client.
