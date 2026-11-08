# Plan — Bootstrap `balance-mobile` (Expo client for the `balance` API)

## Context

`balance-manager/` is an empty repo (only `PRD.md`, `.gitignore`, a stub `package.json`). The
`balance` backend (`/Users/jayro/Dev/Node/Projects/balance`) is a single-user personal-finance REST
API (transactions, categories, vaults, computed balance; soft-delete; auth bypassed → `req.userId=1`).
An expert agent wrote `PRD.md` here describing exactly what the mobile client must consume and the
team doc/workflow standard it must adopt from commit one.

Goal: **initialize this project** (attach to global memory, scaffold the team doc set + ADRs) and
**plan the Expo app** so execution is mechanical. The user wants this to become the **template for
all future React Native apps** — keep what works in `employee-mobile-app`, but adopt better modern
patterns where they're genuinely better.

### Locked decisions (resolved with the user)

| Area | Decision | Why / north star |
|---|---|---|
| Workflow | **Expo managed (CNG), prebuild-on-demand.** MVP stays **Expo-Go-compatible** (zero non-SDK native modules). No `android/ios` committed. | Comfortable bare/prebuild path preserved; prebuild is a one-command step when a native lib is needed. Template default for all future RN apps. |
| Env/config | **`app.config.js` + `expo-constants`** loading `.env.dev/.env.stage/.env.prod` via dotenv. **Not** `react-native-config` (native module → breaks Expo Go). `eas.json` build profiles for later. | Managed idiom; survives prebuild. |
| Navigation | **expo-router** (file-based, `app/`). | Runs in Expo Go; it *is* React Navigation native-stack underneath → no perf regression; unchanged across prebuild. Diverges from PRD's `stacks/` — recorded as ADR. |
| Data layer | **RTK Query**, organized via `api.injectEndpoints` — one file per entity. | Auto cache/invalidation, minimal boilerplate for a thin CRUD client; per-file modules give the "turn a slice on/off" modularity. Diverges from PRD's thunks — recorded as ADR. |
| Storage | MVP: **expo-secure-store** (token) + **AsyncStorage** (cache/prefs/active-env), behind one wrapper. | Both Expo-Go-safe. **MMKV is the deferred north star** (needs dev build) — swappable in one file. |
| Perf | Enable **React Compiler** (Expo SDK 54 / React 19); hand-memoize (`useMemo`/`useCallback`/`memo`) only where it measurably helps. | Matches user instinct; avoids premature memo. |
| Language / SDK | **JavaScript/JSX** (team consistency). **Expo SDK 54**, RN 0.81, React 19. | Per PRD §5. |

### Expo Go ↔ dev-build reality (the rule execution must respect)

Expo Go only runs Expo-SDK native modules. Allowed in MVP: `expo-router`, `expo-secure-store`,
`@react-native-async-storage/async-storage`, RTK Query (pure JS), `luxon`, `i18next`, `expo-localization`,
`expo-splash-screen`. **Forbidden until a dev build exists:** `react-native-mmkv`, `react-native-auth0`,
`react-native-config`. Adding any of those = `npx expo prebuild` + dev build (config step, not a rewrite,
because auth/storage are behind seams).

---

## Part A — Initialize the project (docs, ADRs, memory)

Reference: copy/adapt from `/Users/jayro/Dev/Node/Projects/balance/.claude/ADR/` and the doc set in
that repo (`CLAUDE.md`, `ARCHITECTURE.md`).

1. **Global memory** — create files in
   `~/.claude/projects/-Users-jayro-Dev-ReactNative-Projects-balance-manager/memory/`:
   - `project-balance-mobile.md` (type: project) — what this app is, the locked stack decisions above,
     phase-1 scope, link to backend `[[...]]`.
   - `user-rn-template-preferences.md` (type: feedback) — **standing preference for ALL future RN apps**:
     Expo-managed-first + prebuild-on-demand, expo-router, RTK Query, secure-store+AsyncStorage→MMKV,
     React Compiler + selective memo. Why + how to apply.
   - `MEMORY.md` — one-line index pointers to both.

2. **`.claude/ADR/`** — create the log:
   - `ADR-000-template.md`, `README.md` (index) — copy from `balance`.
   - `ADR-001-auth-strategy.md` — adapt backend ADR-001 to the **client** seam: `AUTH_BYPASS` now,
     single token-injection point (RTK Query `prepareHeaders`), Auth0 + RBAC north star.
   - `ADR-002-documentation-and-workflow-standard.md` — copy from `balance` (same standard).
   - `ADR-003-expo-managed-first-prebuild-on-demand.md` — **NEW.** Managed/Expo-Go for MVP, prebuild
     when a native module is required; env via expo-constants. Template baseline for future RN apps.
   - `ADR-004-navigation-expo-router.md` — **NEW.** File-based routing; supersedes PRD's `stacks/`;
     no perf cost (React Navigation underneath); Expo-Go + prebuild safe.
   - `ADR-005-data-layer-rtk-query.md` — **NEW.** RTK Query + `injectEndpoints` per entity; supersedes
     PRD §6.1/§6.2 thunks; tag-based cache invalidation across `/balance`.
   - `ADR-006-storage-securestore-asyncstorage-mmkv-northstar.md` — **NEW.** secure-store + AsyncStorage
     now; MMKV deferred (needs dev build); one storage seam.

3. **Root docs** (adapt PRD's intent; mirror `balance` style):
   - `CLAUDE.md` — stack, commands (`npx expo start`, `--dev-client` later), architecture summary,
     key-files map, conventions, the Expo-Go/dev-build rule.
   - `PRD.md` — keep existing; add a short "Locked decisions (amended)" note pointing to ADR-003..006
     where the build diverges from the original PRD stack table.
   - `ARCHITECTURE.md` — **Mermaid** required: (a) navigation graph (expo-router tree), (b) RTK Query
     data-flow (screen → hook → api → backend, tag invalidation), (c) cold-start/splash state diagram,
     (d) directory/file map.
   - `README.md` — setup, `.env.*` config, run (Expo Go now / dev-client later), build (EAS) notes.
   - `.claude/agents/plans/` — created (this plan can be copied in at execution).

---

## Part B — Scaffold the Expo app

Generate with the current managed template, then layer the structure. Keep `android/ios` **out** of git.

```
npx create-expo-app@latest . --template blank   # JS, then align to SDK 54
# add: expo-router expo-secure-store expo-splash-screen expo-localization expo-constants
#      @reduxjs/toolkit react-redux @react-native-async-storage/async-storage
#      luxon i18next react-i18next
```

### Directory layout (managed + expo-router)

```
balance-mobile/
├── app.config.js              # reads .env.${APP_ENV} via dotenv → extra; expo-router plugin; RC enabled
├── eas.json                   # build profiles: development(dev-client) / preview(stage) / production(prod)
├── .env.dev  .env.stage  .env.prod   # API_URL, AUTH_BYPASS, APP_ENV
├── index.js                   # expo-router/entry
├── app/                       # ROUTES (expo-router)
│   ├── _layout.jsx            # Root: Providers (Redux), SecureStore→token bootstrap, SplashWrapper, Stack
│   ├── index.jsx              # boot redirect → (tabs) or (auth) based on AUTH_BYPASS/token
│   ├── (auth)/                # login entry (disabled in prototype) — _layout + login.jsx
│   └── (tabs)/                # bottom tabs
│       ├── _layout.jsx        # Tabs: Dashboard, Transactions, Vaults, Categories, Settings
│       ├── dashboard.jsx
│       ├── transactions/      # index (list+filters), [id].jsx (detail), new.jsx (create/edit form)
│       ├── vaults/            # index, [id].jsx (history + allocate/withdraw)
│       ├── categories.jsx
│       └── settings.jsx
├── src/
│   ├── store/                 # configureStore({ reducer:{ [api.reducerPath]: api.reducer, auth } }) + setupListeners
│   ├── services/
│   │   ├── api/
│   │   │   ├── baseApi.js     # createApi: fetchBaseQuery({ baseUrl, prepareHeaders→token }) + tagTypes, empty endpoints
│   │   │   ├── balance.js     # injectEndpoints: getBalance  (tag: Balance)
│   │   │   ├── transactions.js# inject: list/get/add/update/delete (invalidates Transaction, Balance)
│   │   │   ├── vaults.js      # inject: list/get/add/update/delete/history/allocate/withdraw (inval Vault,VaultHistory,Balance)
│   │   │   └── categories.js  # inject: CRUD (tag: Category)
│   │   └── storage/
│   │       ├── secure.js      # expo-secure-store wrapper: getToken/setToken/clearToken
│   │       └── prefs.js       # AsyncStorage wrapper: activeEnv, lng_preference, generic getKey/setKey
│   ├── reducers/auth/         # createSlice: { token, bypass, user } (token-injection source of truth)
│   ├── hooks/                 # useIdToken(), data hooks re-exporting RTKQ hooks if useful
│   ├── components/            # Button, Input, Card, Header, MoneyText, VaultProgress, FilterChips, FAB...
│   ├── utils/
│   │   ├── config.js          # reads expo-constants extra → { API_URL, AUTH_BYPASS, ENV } (Config.* shape)
│   │   ├── money.js           # formatMoney(amount, currency)
│   │   └── dates.js           # luxon helpers (occurred_at date, created_at ISO)
│   └── i18n/                  # i18next init + locales/{en-US,es-MX}.json (expo-localization for device lng)
└── (docs + .claude from Part A)
```

### RTK Query specifics

- `baseApi.js`: `fetchBaseQuery({ baseUrl: Config.API_URL, prepareHeaders: (h, {getState}) => h.set('Authorization', \`Bearer ${selectToken(getState())}\`) })`.
  In bypass mode `selectToken` returns a placeholder (backend ignores it). **This is the single auth seam** (ADR-001).
- `tagTypes: ['Balance','Transaction','Vault','VaultHistory','Category']`.
- Invalidation: any transaction create/update/delete and vault allocate/withdraw → `invalidatesTags:['Balance','Vault']`
  so the dashboard `total`/`available`/per-vault figures refetch automatically (PRD note: balances come from `/balance`).
- Backend error contract `{ error }` (PRD §4): a `transformErrorResponse` surfaces `error` as the user-facing message.
- Respect invariants client-side too: hide/disable vault picker when `type==='expense'`; only income txns are
  allocatable (PRD §4.1).
- Each entity file uses `baseApi.injectEndpoints({ endpoints })` and re-exports its hooks → delete the file +
  its import to remove that "slice."

### Env / config flow

- `app.config.js`: `require('dotenv').config({ path: \`.env.${process.env.APP_ENV ?? 'dev'}\` })`, then expose
  `extra: { apiUrl: process.env.API_URL, authBypass: process.env.AUTH_BYPASS === 'true', env: process.env.APP_ENV }`.
- Run: `APP_ENV=dev npx expo start` / `stage` / `prod`. `utils/config.js` reads `Constants.expoConfig.extra`.
- `AUTH_BYPASS` defaults **off** outside dev/stage (ADR-001 guard).
- `eas.json` later sets `APP_ENV` per profile + `developmentClient:true` on the development profile.

### Cold start / splash (replaces team's `Stack.jsx` flow, via expo-router)

Root `app/_layout.jsx`: keep `expo-splash-screen` visible while: (1) i18n init, (2) read token from
secure-store + AUTH_BYPASS into the `auth` slice, (3) fonts. Then `SplashScreen.hideAsync()` and
`app/index.jsx` redirects to `(tabs)` (bypass/has-token) or `(auth)`.

---

## Build order (execution)

1. Part A docs/ADRs/memory (no app code).
2. `create-expo-app` + deps + `app.config.js`/`.env.*`/`eas.json` + React Compiler + babel/metro.
3. `src/utils/config.js`, `storage/`, `reducers/auth`, `store/`, `baseApi.js`.
4. Entity API files (balance → categories → transactions → vaults) with tags/invalidation.
5. expo-router shell: `_layout`, splash bootstrap, `(tabs)` + `(auth)`.
6. Screens in PRD §8 order: Dashboard → Transactions CRUD → Vaults (history/allocate/withdraw) → Categories → Settings.
7. i18n strings, `formatMoney`, date helpers, shared components.
8. `ARCHITECTURE.md` mermaid finalized against the real tree.

## Verification

- `npx expo-doctor` clean; `npx expo-modules-autolinking verify -v` shows only SDK modules (Expo-Go-safe).
- `APP_ENV=dev npx expo start` → open in **Expo Go**; app boots straight to tabs (bypass), no native-module crash.
- Point `.env.dev` `API_URL` at the running `balance` backend (`NODE_ENV=stage npm start`, no `/api` prefix).
  Verify end-to-end: Dashboard loads `/balance`; create an **income** txn → allocate to a vault → Dashboard
  `available` drops and vault `balance` rises (tag invalidation working); withdraw reverses it; expense txn
  cannot pick a vault; soft-deleted resource shows as gone.
- `jest` for `formatMoney`, config selection, and one RTKQ endpoint (optional in MVP).
- Confirm `git status` does not track `android/`, `ios/`, `.env*`.

## Out of scope (recorded as phases/north-stars)

MMKV swap, Auth0 + RBAC + AuthStack (Phase 2), offline cache, charts/budgets/recurring, multi-currency,
push (Phase 3). Each gets a plan in `.claude/agents/plans/` when started.
