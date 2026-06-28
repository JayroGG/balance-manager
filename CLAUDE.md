# CLAUDE.md — `balance-mobile`

Project-specific context for Claude Code. Read together with the global `~/.claude/CLAUDE.md`,
`PRD.md`, `ARCHITECTURE.md`, and `.claude/ADR/`.

## What this is

The **Expo React Native client** for the `balance` backend — a single-user personal-finance REST API
(transactions, categories, savings **vaults**, and a computed **balance**: `total` / `available` /
per-vault). POC stage. The app is a **thin client**: the backend owns all business logic and the
cents↔decimal money boundary; the app consumes **decimals** and renders them with the currency label
`/balance` returns. See `PRD.md` for the full contract and `ARCHITECTURE.md` for diagrams + file map.

Backend repo: `/Users/jayro/Dev/Node/Projects/balance` (Express + better-sqlite3). It mounts routes at
the **root** (no `/api` prefix). Auth is **required**: every request needs `Authorization: Bearer <token>`
(the backend's own email/password JWT). Entities are **personal** or **team**-scoped via a `?team_id=`
query param. See ADR-011 and `docs/backend-auth-teams-contract.md`.

## Tech stack (see ADR-003..006 for the "why")

- **Runtime:** Expo SDK 56 (managed / CNG), React Native 0.85, React 19.2. **JavaScript/JSX**, no TS.
- **Navigation:** **expo-router** (file-based, `app/`) — ADR-004.
- **State / data:** **Redux Toolkit + RTK Query** (`api.injectEndpoints`, one file per entity) — ADR-005.
- **Storage:** `expo-secure-store` (token) + `@react-native-async-storage/async-storage` (cache/prefs);
  MMKV is the deferred north star — ADR-006.
- **Persistence:** `redux-persist` over the RTK Query `api` reducer → instant cold-start paint + offline
  reads. Token is **not** persisted here (stays in secure-store). Local-first offline-writes + sync
  (`expo-sqlite` + outbox) is the Phase-3 north star — ADR-007.
- **Config/env:** `app.config.js` + `expo-constants` reading `.env.dev/.env.stage/.env.prod` — ADR-003.
- **Auth:** single token seam (RTK Query `prepareHeaders`); real **email/password JWT** login/logout, `401`
  auto-logout; **bypass is dev-only**. Ships in Expo Go (no Auth0, no dev build) — ADR-011 (supersedes ADR-001).
- **Team context:** a `context` slice (`activeTeamId`, `null` = personal) threaded as `?team_id=` through
  every entity call (Dashboard switch); read-only `GET /teams`; team CRUD deferred — ADR-011.
- **i18n / dates:** `i18next` + `react-i18next` + `expo-localization`; `luxon`.
- **Perf:** React Compiler enabled; hand-memoize only where it measurably helps.

## ⚠️ The Expo Go ↔ dev-build rule (ADR-003)

The MVP runs in **Expo Go**, which only loads **Expo-SDK** native modules. **Allowed:** expo-router,
expo-secure-store, async-storage, expo-splash-screen, expo-localization, expo-constants, and any pure-JS
lib (RTK Query, luxon, i18next). **Forbidden until a dev build exists:** `react-native-mmkv`,
`react-native-auth0`, `react-native-config`. Adding one of those = `npx expo prebuild` + dev build —
a config step, not a rewrite (auth/storage/config are behind seams). Do **not** commit `android/ios`.

## Key commands

```bash
APP_ENV=dev   npx expo start      # Metro + Expo Go (default env = dev)
APP_ENV=stage npx expo start
APP_ENV=prod  npx expo start
npx expo-doctor                    # health check
npx expo-modules-autolinking verify -v   # confirm only SDK native modules (Expo-Go safe)
npm test                           # jest
# later (dev build): npx expo prebuild  /  eas build --profile development
```

Point `.env.dev` `API_URL` at the running backend (`cd ../../Node/Projects/balance && NODE_ENV=stage npm start`).

## Architecture (summary)

- **`app/` = routes only** (expo-router's required root folder). Each `(tabs)` screen file is a **1-line
  shim** (`export { default } from '../../src/screens/X'`); the only logic in `app/` is router infra:
  root `_layout.jsx` runs the cold-start bootstrap (load token from secure-store + `AUTH_BYPASS` into the
  `auth` slice, init i18n) behind the splash, and `index.jsx` redirects to `(tabs)` or `(auth)`.
- **`src/` = all real code.** Screen bodies live in `src/screens/<Name>/` (composition + data hooks);
  shared atoms/molecules in `src/components/ui/` (one file each + `index.js` barrel); `theme.js` alongside.
  Three layers: **route (app/) → screen (src/screens) → component (src/components)** — see ADR-008.
- **Data:** components call RTK Query hooks only — never `fetch`, never manual loading state. Mutations
  invalidate tags (`Balance`, `Vault`, …) so the dashboard auto-refreshes (balances come from `/balance`).
- **Auth seam:** the only place a token is attached is `src/services/api/baseApi.js` `prepareHeaders`.
- **Storage seam:** the only place AsyncStorage/secure-store are touched is `src/services/storage/`.

## Key files

| Path | Purpose |
|---|---|
| `app.config.js` | Loads `.env.${APP_ENV}` → `extra`; expo-router plugin; React Compiler. |
| `.env.dev` / `.env.stage` / `.env.prod` | `API_URL`, `AUTH_BYPASS`, `APP_ENV`. **Not** committed. |
| `eas.json` | Build profiles: development (dev-client) / preview (stage) / production. |
| `app/_layout.jsx` | Root providers + cold-start bootstrap + splash gate. |
| `app/index.jsx` | Boot redirect → `(tabs)` or `(auth)`. |
| `app/(tabs)/*` | Thin route shims → render screens from `src/screens/`. |
| `src/screens/<Name>/` | Screen bodies (Dashboard, Transactions, Vaults, Categories, Settings). |
| `src/components/ui/` | Shared atoms/molecules, one file each + `index.js` barrel. |
| `src/services/api/baseApi.js` | RTK Query base: `fetchBaseQuery` + token seam + `401` auto-logout + `tagTypes`. |
| `src/services/api/auth.js` | `login`/`logout` mutations. |
| `src/services/api/teams.js` | `getTeams` (now returns per-team `role`) + team/member CRUD mutations (`:id`-path scoped, **not** `?team_id=`); tags `Team` / `TeamMember` (ADR-012). |
| `src/permissions/index.js` | RBAC seam: `usePermissions` + pure `canAdd`/`canEditRow(row)`/`canManageTeam` matrix (ADR-012). |
| `src/hooks/useActiveRole.js` | Active-context role derived from cached `getTeams` + `activeTeamId` (`null` = personal). |
| `src/utils/jwt.js` | `decodeUser(token)` → `{ id }` from the JWT `sub` (the `myUserId` source for member gating). |
| `src/screens/Teams/` | `ListScreen` (owned / member-of + create) and `ManageScreen` (owner: rename / members / roles / delete). |
| `src/services/api/{balance,transactions,vaults,categories}.js` | `injectEndpoints` per entity (each threads optional `team_id`). |
| `src/services/api/teamParam.js` | `withTeam(path, team_id)` — appends `?team_id=` (the one place it's built). |
| `src/services/storage/{secure,prefs}.js` | Token (secure-store) / cache+prefs (AsyncStorage) seam. |
| `src/reducers/auth/` | `auth` slice: token/bypass/user (token-injection source of truth). |
| `src/reducers/context/` | `context` slice: `activeTeamId` (`null` = personal); persisted, reset on logout. |
| `src/screens/Login/` | Email/password login screen (`app/(auth)/login.jsx` is its shim). |
| `src/store/` | `configureStore` + RTK Query reducer/middleware + `setupListeners` + `redux-persist` (persists `api` only). |
| `src/utils/config.js` | Reads `expo-constants` extra → `{ API_URL, AUTH_BYPASS, ENV }`. |
| `src/utils/{money,dates}.js` | `formatMoney(amount, currency)`; luxon helpers. |
| `src/i18n/` | i18next init + `locales/{en-US,es-MX}.json`. |

## Workflow

Global loop for non-trivial work: `/prime → /plan-feature → /execute → /commit` (conventional commits).
Plans go in `.claude/agents/plans/`; decisions in `.claude/ADR/`; long-term memory in
`~/.claude/projects/<path>/memory/`.

## Conventions

- Minimal changes — only what's asked; no unrequested refactors or comments.
- Validate at boundaries only (form input); trust the backend's invariants but mirror the obvious ones
  in UI: transactions are a **pure ledger** (no vault field); vaults are funded by **amount-based**
  allocate/withdraw, capped client-side at `available` / the vault balance; **`available` can never go
  negative** (overspending locked money 400s); a vault deletes only at a zero balance; amounts are
  positive (the `type` carries the sign). See ADR-009 / backend ADR-004.
- Money is **decimal** end-to-end on the client; never send cents.
- Soft-deleted resources return `404` — treat as gone.
- **Auth:** every call carries the token via the single seam (`baseApi.prepareHeaders`) — never read or set
  the token elsewhere. A `401` (except on `/auth/login`) clears auth + cache and routes to login. Bypass is
  **dev-only**.
- **Team context:** `team_id` is a **query param, never a body field** — append it via `withTeam(...)` and
  destructure it out of mutation bodies. Pass the active `team_id` (from `selectActiveTeamId`) into every
  entity hook/mutation so personal/team caches stay isolated.
- **RBAC (ADR-012):** gate every write affordance through `usePermissions()` (`src/permissions`) — guest is
  read-only, member edits/deletes only its own rows (`row.user_id === myUserId`), owner does all, personal
  context = full access. Role is **derived** via `useActiveRole` (never stored); `myUserId` comes from the
  JWT `sub` (`decodeUser`). The backend enforces the same rules and `403`s a violation — surface it, don't
  log out. Team-management endpoints are `:id`-path scoped (no `team_id`).
