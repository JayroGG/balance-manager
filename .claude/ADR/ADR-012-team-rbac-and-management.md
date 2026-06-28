# ADR-012 — Team RBAC (role-gated UI) and the team-management screen

- **Status:** Accepted
- **Date:** 2026-06-28
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** **Extends ADR-011** (auth + team context) — fulfils the team-management
  CRUD + per-context RBAC it explicitly deferred. Builds on ADR-003 (managed-first / Expo-Go-safe),
  ADR-005 (RTK Query), ADR-008 (thin routes → `src/screens`), ADR-010 (testing). Mirrors the backend's
  RBAC + team-management update.

## Context

The `balance` backend shipped two more changes on top of ADR-011's auth + team context (brief:
`/Users/jayro/Dev/Node/Projects/balance/docs/react-native-rbac-and-team-management-update.md`; repo
reference: `docs/backend-auth-teams-contract.md`):

1. **Role-based access control inside teams.** Every membership now has a **role** — `owner | member |
   guest`. `GET /teams` returns the caller's role per team. **Reads are open to all roles.** Writes
   depend on role, and for `member` also on **row ownership** (`record.user_id === myUserId`):
   - **owner** — read all, add, edit/delete/allocate/withdraw **any** row, manage the team.
   - **member** — read all, add, but edit/delete/allocate/withdraw **only rows they created**.
   - **guest** — **read-only**.
   The API enforces this and returns **403** on a disallowed write (a 403 means "no permission here" —
   it is **not** a session-over signal; the user stays logged in).

2. **The full team-management API** — create / rename / delete a team, and list / add / change-role /
   remove members (owner-gated, with guardrails: can't remove the last owner, can't delete a non-empty
   team, adding an unregistered email 404s).

ADR-011 deliberately deferred both ("full team-management CRUD and per-context RBAC are deferred… only
read-only `GET /teams` is wired now"). This ADR closes that gap. **Personal context (no `team_id`) is
unchanged — always fully the user's own data, no role gating.**

Constraint carried from ADR-003: this must stay **Expo-Go-safe** (no native modules). The only new
dependency considered, `jwt-decode`, is pure JS and qualifies.

## Decision

Two coordinated pieces — **RBAC gating** of the existing financial screens, and a **team-management
screen** — recorded as one decision, then shipped as **two `/plan-feature` runs** (RBAC first, the
screen second).

### 1. Identity — persist `myUserId`, decoded from the JWT

- Member gating needs `myUserId` to compare against `row.user_id`, but `POST /auth/login` returns only
  `{ token }`. We **decode the JWT `sub` claim** with **`jwt-decode`** (pure-JS, Expo-Go-safe) — no
  backend change.
- A single `decodeUser(token)` helper extracts `{ id }` (and email if present). It is called in
  **exactly two places**: the `Login` submit (after the token is persisted) and the **cold-start
  bootstrap** in `app/_layout.jsx` (which already reads the token from secure-store) →
  `hydrateAuth({ token, user })`. Add `selectMyUserId`.
- **Boundary:** `auth.user` is **not persisted** — the auth slice never is (the token lives in
  expo-secure-store, ADR-006); `user` is re-derived from the token on every cold start. No store /
  persistence change.

### 2. Active role — **derived, not stored**

- The role is **not** duplicated into the `context` slice. It is derived from the cached `getTeams`
  result + `activeTeamId` via a new `useActiveRole()` hook. `activeTeamId == null` (personal) → role
  `null` → full access.
- **Boundary:** `getTeams` is cached, `providesTags: ['Team']`, and refetches on mount/arg-change; team
  mutations invalidate `Team`. So the single source stays fresh and there is no second copy to go stale.
  This satisfies the brief's "re-read the role from `GET /teams`."

### 3. A permissions **seam** — one source of gating truth

Mirroring the `withTeam` single-seam philosophy (ADR-011), a new permissions module exposes a **pure**
`can(action, { role, row, myUserId })` plus a `usePermissions()` hook returning
`{ role, canAdd, canEdit(row), canManageTeam }`:

| role | canAdd | canEdit(row) | canManageTeam |
|---|---|---|---|
| personal (`null`) | ✅ | ✅ | n/a |
| `owner` | ✅ | ✅ (any row) | ✅ |
| `member` | ✅ | `row.user_id === myUserId` | ❌ |
| `guest` | ❌ | ❌ | ❌ |

The pure function is unit-tested (ADR-010 — behaviour, not design). **Gating is a UI affordance layered
on top of the API, which stays the authority** (the brief: "do this, don't rely only on the API").

### 4. Where the seam is consumed

- **Transactions:** `ListScreen` FAB → `canAdd`; `EditScreen` save/delete → `canEdit(tx)`.
- **Vaults:** `ListScreen` FAB → `canAdd`; `DetailScreen` allocate/withdraw/save/delete →
  `canEdit(vault)`.
- **Categories:** add/edit/delete — **open item:** confirm whether category rows carry `user_id`; if
  not, gate member category writes conservatively (owner-only) or lean on the API 403. Verify against
  the live API before that task.
- **Dashboard:** read-only; a **role badge** on the context-switch chips. No write gating.
- **Guest:** the whole selected context renders read-only (every affordance above hidden).

Per-row member gating happens on the **detail** screens (using the fetched record's `user_id`) — list
rows are read-only links, so `user_id` need not be threaded into list rendering.

### 5. Team-management API + a new visible "Teams" tab

- Extend `src/services/api/teams.js` with mutations — **`:id`-path scoped, so `withTeam` is NOT used**
  here (these are not `?team_id=` calls): `createTeam`, `updateTeam`, `deleteTeam`, `getMembers`,
  `addMember`, `updateMemberRole`, `removeMember`. New tag **`TeamMember`** added to `baseApi.tagTypes`;
  team mutations invalidate `Team`, member mutations invalidate `TeamMember` (the member write endpoints
  also return the updated list).
- A **new visible bottom tab "Teams"** (ADR-008 layering): `app/(tabs)/teams/{_layout,index,[id]}.jsx`
  thin shims → `src/screens/Teams/{ListScreen,ManageScreen}.jsx` (+ a read-only member detail for
  non-owners), registered in `app/(tabs)/_layout.jsx`. The list groups **owned vs member-of** with a
  create action; an owner row opens Manage (rename / add by email + role / change role / remove /
  delete); a non-owner row opens a read-only member list.
- **Guardrails surfaced in the UI** (the API also enforces them): 403 → "no permission" (no logout);
  404 on add-by-email → "No account for that email"; 400 last-owner → disable demote/remove on the sole
  owner; 400 non-empty delete → blocking "clear this team's transactions and vaults first."

### North star (deferred)

Transfer-ownership flow, RBAC richer than owner/member/guest, and offline reconciliation of role
changes are out of scope. The seams above (permissions module, `useActiveRole`, `TeamMember` tag) are
where that future work attaches.

## Consequences

- **Positive:** real, mirrored RBAC with **zero new native dependencies** — still Expo-Go-safe; the only
  add is pure-JS `jwt-decode`.
- **Positive:** the ADR-011 seams pay off again — role falls out of the existing `getTeams` cache key,
  the permissions seam centralizes every gate, and 403-as-message already worked (only 401 logs out).
- **Positive:** identity (`myUserId`) needs no backend change and no extra persistence — it rides the
  token we already store.
- **Negative / trade-offs:** every financial screen gains a `usePermissions()` call site; member gating
  needs the detail record's `user_id`. Deriving role (vs storing it) means a screen rendered before
  `getTeams` resolves briefly has no role — handled by treating an unknown team role as read-only until
  the list loads.
- **Follow-ups:** two plans in `.claude/agents/plans/` — **(1) RBAC gating** (jwt-decode + `auth.user` +
  `useActiveRole` + permissions seam + screen gating + role badge + i18n) and **(2) team management**
  (teams mutations + members + the Teams tab/screens). Verify the categories `user_id` question against
  the live API. Refresh `PRD.md` §9 and `ARCHITECTURE.md` once the feature lands.

## Alternatives considered

- **Store the role in the `context` slice** (the brief's literal "store role alongside `team_id`).
  Rejected: it duplicates a value already in the `getTeams` cache and goes stale on a role change;
  deriving from the cached query keeps one source of truth and refreshes for free.
- **Hand-roll a base64 JWT-payload decoder** instead of `jwt-decode`. Rejected: more code to own and
  test for no benefit; `jwt-decode` is tiny, pure JS, and Expo-Go-safe (and was already anticipated in
  the PRD draft).
- **Ask the backend to return the user object on `/auth/login`.** Rejected: a cross-repo change and a
  new dependency for data we can already read from the token.
- **Reach team management from a hidden route (Settings / Dashboard switcher only).** Rejected in favour
  of a **visible "Teams" tab** for discoverability; it also keeps the screen behind the existing
  `(tabs)` auth guard.
- **Rely on the API's 403 alone, with no UI gating.** Rejected: the brief is explicit — gate the UI so
  disallowed actions aren't even offered; the 403 is the backstop, not the primary control.
