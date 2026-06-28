# Plan 002 — Auth (login/logout/401) + Team context

**Status:** Executed · **Date:** 2026-06-28 · **ADR:** ADR-011 (supersedes ADR-001)

Real email/password JWT auth (login / logout / `401` auto-logout; bypass made dev-only) plus a client-side
**team context** that reuses every existing screen — a Personal/Team switch on the Dashboard threads
`?team_id=` through every entity call. No team-management CRUD (only read-only `GET /teams`). Ships in Expo
Go (no native module, no prebuild). Full rationale: `.claude/ADR/ADR-011-auth-jwt-and-team-context.md`;
contract: `docs/backend-auth-teams-contract.md`.

> `.claude/` is git-ignored — `git add -f` this plan and ADR-011.

## Key reuse (don't re-invent)
- Token seam: **only** `src/services/api/baseApi.js` `prepareHeaders`.
- Error shape: `baseQueryWithErrorShape` already yields `error.message` — Login just renders it.
- UI atoms: `Field`, `AppButton`, `Screen`, `Chip`, `Card` (`src/components/ui`).
- Storage: `src/services/storage/secure.js` (`getToken/setToken/clearToken`).
- `?team_id=` building: the one `withTeam(path, team_id)` helper.

## Steps (validate after each — `npm test`)

### Auth
1. **`src/services/api/auth.js`** (new) — `login` (`POST /auth/login {email,password}` → `{token}`) +
   `logout` (`POST /auth/logout`) mutations; export hooks. Register in `src/services/api/index.js`.
2. **`src/services/api/baseApi.js`** — in `baseQueryWithErrorShape`, on `result.error.status === 401` &&
   `api.endpoint !== 'login'`: `dispatch(clearAuth())`, `await clearToken()`,
   `dispatch(baseApi.util.resetApiState())`. Add `'Team'` to `tagTypes`.
3. **`src/screens/Login/index.jsx`** (new) — email + password; `login().unwrap()` → `setToken` (secure +
   slice); inline `err.message`. **`app/(auth)/login.jsx`** → 1-line shim.
4. **`app/(tabs)/_layout.jsx`** — guard: `if (!useSelector(selectIsAuthed)) return <Redirect href="/(auth)/login" />`.
5. **`src/screens/Settings/index.jsx`** — Logout button when `!bypass`: `logout()` → `clearToken` →
   `clearAuth` → `resetContext` → `resetApiState`.
6. **`src/utils/config.js`** — `AUTH_BYPASS = extra.authBypass === true && (extra.env ?? 'dev') === 'dev'`.
7. **`.env.example`** — bypass guidance → dev-only. (Real `.env.stage/.env.prod` are user-owned, not in repo.)

### Team context
8. **`src/reducers/context/index.js`** (new) — `{ activeTeamId: null }`; `setActiveTeam`/`resetContext`;
   `selectActiveTeamId`. **`src/store/index.js`** — add reducer + `'context'` to persist whitelist.
9. **`src/services/api/teams.js`** (new) — `getTeams` query (`providesTags: ['Team']`). Register.
10. **`src/services/api/teamParam.js`** (new) — `withTeam(path, team_id)`.
11. **`src/services/api/{balance,transactions,vaults,categories}.js`** — thread optional `team_id` through
    each arg → `withTeam(...)` on the URL; mutations destructure `team_id` **out of the body**; single-item
    GETs take `{ id, team_id }`.
12. **`src/screens/Dashboard/index.jsx`** — Personal + per-team `Chip` switch (`useGetTeamsQuery`) →
    `dispatch(setActiveTeam(...))`; `useGetBalanceQuery(teamId)`.
13. **Consuming screens** — read `teamId = useSelector(selectActiveTeamId)` and thread into hooks/mutations:
    `Transactions/{ListScreen,NewScreen,EditScreen}`, `Vaults/{ListScreen,NewScreen,DetailScreen}`,
    `Categories/index`.

### i18n + tests
14. **`src/i18n/locales/{en-US,es-MX}.json`** — `auth.*`, `context.*`.
15. **`src/reducers/context/index.test.js`** (new) — reducers + selector.
16. **`src/services/api/endpoints.test.js`** — `/auth/login`,`/auth/logout`,`/teams`, `?team_id=` URLs, and
    `team_id` absent from POST/PUT bodies.
17. **`src/services/api/baseApi.test.js`** — `401` non-login clears auth/token/cache; `401` on `login` doesn't.

### Docs
18. ADR-011 (+ README index, ADR-001 status flip) · `docs/backend-auth-teams-contract.md` · PRD §0/§4/§7/§9 ·
    CLAUDE.md conventions · this plan.

## Verify
- `npm test` (all green).
- `npx expo-modules-autolinking verify -v` + `npx expo-doctor` → no new native module (no dependency added).
- Backend up, `AUTH_BYPASS=false` in `.env.stage`: `APP_ENV=stage` requires login; team switch refetches in
  context; logout returns to Login; expired token → `401` → Login. `APP_ENV=dev` boots straight to tabs.
