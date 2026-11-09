# Feature: Jest test suite (jest-expo preset) — pure logic + seams

The following plan should be complete, but it's important that you validate documentation and codebase
patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, exports, and slice actions. Import from the right
files (e.g. cross-entity model/seam access rules in CLAUDE.md). Do not refactor product code to make it
testable unless a task explicitly says so — these tests target the code **as-built**.

## Feature Description

Stand up the project's first automated test suite. `package.json` already wires `npm test → jest` but
there is **no jest config, no preset, and zero tests**. Per **ADR-010**, adopt the Expo-official
**`jest-expo`** preset (SDK 56 line) with `@testing-library/react-native`, a root `jest.setup.js`, and
colocated `*.test.js` files — mirroring the conventions Jayro already uses in `employee-mobile-app`
(`@testing-library/react-native`, colocated tests, `jest`-key config, `npm run coverage`) while using
the **managed-app** preset instead of that repo's bare `react-native` preset.

Scope is deliberately the **pure logic + the architectural seams**, where a thin client earns stable
tests: `utils/money.js`, `utils/dates.js`, the `auth` slice + `selectToken` placeholder logic
(ADR-001), `baseApi`'s error-shape transform + `prepareHeaders` auth seam (ADR-005), and the RTK Query
transaction/vault endpoint URL + tag-invalidation wiring. Screen/render tests are explicitly deferred
(ADR-010 north star).

## User Story

As a developer on `balance-mobile`
I want a fast, Expo-Go/prebuild-safe test suite over the app's pure logic and seams
So that I can refactor the money formatting, auth-token injection, error surfacing, and cache
invalidation with confidence and catch regressions before they reach a screen.

## Problem Statement

The app ships money math, an auth-token seam, a backend-error-normalization transform, and cache-tag
invalidation wiring — all logic that is easy to break silently and currently has **no** test coverage.
`npm test` runs jest with no config, so it errors/finds nothing. There is no agreed test convention for
this (managed Expo) repo, only the bare-RN one from `employee-mobile-app` that does not transfer.

## Solution Statement

Configure jest with the `jest-expo` preset (one `jest` block in `package.json` + a minimal
`jest.setup.js`), add the dev dependencies, and write colocated unit tests for the pure utils and a
small set of store-integration tests for the RTK Query seams (real store + mocked `global.fetch`,
asserting the outgoing `Request` URL/headers and the normalized error). No product code changes.

## Feature Metadata

**Feature Type**: New Capability (test infrastructure + initial suite)
**Estimated Complexity**: Medium (config + fetch/seam mocking nuances; the tests themselves are small)
**Primary Systems Affected**: tooling (`package.json`, new `jest.setup.js`), `src/utils`,
`src/reducers/auth`, `src/services/api`
**Dependencies (devDeps)**: `jest-expo@~56.0.5`, `@testing-library/react-native@^14`,
`react-test-renderer@19.2.0`, `jest@^29` (transitive via jest-expo, pin if needed)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `package.json` (whole file) — Why: where the `jest` config block + `coverage` script go; current deps
  list (no test deps yet). `main` is `expo-router/entry`.
- `babel.config.js` — Why: `babel-preset-expo` only; `jest-expo` uses this same babel config to
  transform tests. Do **not** change it.
- `.npmrc` — Why: `legacy-peer-deps=true` is set, so installing devDeps with the jest-expo peer set
  (`react-server-dom-webpack`, `@react-native/jest-preset`) will not be blocked by peer conflicts.
- `src/utils/money.js` (lines 1-9) — Why: `formatMoney(amount, currency='USD')` — `Intl.NumberFormat`
  with a `try/catch` fallback to `` `${currency} ${value.toFixed(2)}` ``; coerces `amount ?? 0` via
  `Number`. Test both the Intl path and the fallback (invalid currency code).
- `src/utils/dates.js` (lines 1-10) — Why: luxon helpers `todayISODate()`, `formatDate(iso)`,
  `formatDateTime(iso)`. `formatDate`/`formatDateTime` return `''` for falsy input; `formatDateTime`
  parses as UTC then `.toLocal()`. Tests must pin locale/zone to be deterministic (see GOTCHA).
- `src/reducers/auth/index.js` (lines 1-43) — Why: the unit-under-test for the auth seam source.
  `PLACEHOLDER_TOKEN = 'bypass-placeholder-token'`. Actions: `hydrateAuth`, `setToken`, `clearAuth`.
  Selectors: `selectToken` (returns placeholder when `bypass && !token`), `selectIsAuthed`,
  `selectBootstrapped`. `initialState.bypass = Config.AUTH_BYPASS` is read at module load → mock config
  when testing `initialState`/reducer; selectors are pure (take `state`) and need no config mock.
- `src/services/api/baseApi.js` (lines 1-42) — Why: the auth seam (`prepareHeaders` → `Bearer <token>`)
  and `baseQueryWithErrorShape` (maps backend `{ error }`/`{ message }` body → `error.message`, else
  `` `Request failed (${status})` ``). `tagTypes`, `refetchOnMountOrArgChange`. `baseUrl` comes from
  `Config.API_URL` (undefined in test → fine, fetch is mocked; assert path suffix not full origin).
- `src/services/api/transactions.js` (lines 1-50) — Why: `getTransactions` builds a query string from
  `{ type?, category_id? }` via `URLSearchParams`, **dropping** `undefined`/`null`/`''`. Mutations
  `invalidatesTags` include `'Balance'`. Pure URL-building + invalidation wiring to assert.
- `src/services/api/vaults.js` (lines 1-75) — Why: `allocateVault`/`withdrawVault` POST `{ amount }` to
  `/vaults/:id/(allocate|withdraw)` and invalidate `Vault`, `VaultHistory`, `LIST_TAG`, `'Balance'`.
- `src/services/api/balance.js` (lines 1-13) — Why: `getBalance` → `/balance`, `providesTags:['Balance']`.
  Used as the "did an invalidation trigger a refetch?" probe.
- `src/services/api/index.js` (lines 1-7) — Why: barrel; importing it runs every `injectEndpoints()`.
  Import this (or `src/store`) in seam tests so endpoints are registered.
- `src/store/index.js` (lines 1-47) — Why: shows the exact store wiring to MIRROR in seam tests —
  `combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer })` +
  `.concat(baseApi.middleware)` + the `serializableCheck.ignoredActions`. Do **not** import the real
  persisted store into tests; build a fresh store per test (redux-persist + AsyncStorage adds noise).
- `src/services/storage/secure.js` (lines 1-8) — Why: example seam over `expo-secure-store`
  (`getItemAsync`/`setItemAsync`/`deleteItemAsync`); reference if you add a storage test (optional).
- `employee-mobile-app/jest.setup.js` and its `package.json` `jest` block — Why: the convention to
  echo (setupFilesAfterEnv, colocated tests, `coverage` script). **Differences to keep:** that repo is
  bare RN → `preset: 'react-native'` + a hand-written `__mocks__/expo-modules-core.js`. We use
  `preset: 'jest-expo'` and write **no** such mock (jest-expo auto-mocks Expo modules).
- `.claude/ADR/ADR-010-testing-jest-expo-preset.md` — Why: the decision + the prebuild/pure-RN boundary
  this plan implements.
- `.claude/ADR/ADR-003-expo-managed-first-prebuild-on-demand.md` — Why: the Expo-Go/prebuild constraint;
  jest-expo is a devDep/test-time preset, so it adds no native module and respects this.

### New Files to Create

- `jest.setup.js` (repo root) — `setupFilesAfterEnv` entry: silence known noisy logs if needed and host
  any global test config. Keep minimal — jest-expo already mocks Expo modules.
- `src/utils/money.test.js` — unit tests for `formatMoney`.
- `src/utils/dates.test.js` — unit tests for `todayISODate`/`formatDate`/`formatDateTime`.
- `src/reducers/auth/index.test.js` — reducer + selector tests (the auth seam source, ADR-001).
- `src/services/api/baseApi.test.js` — store-integration: `prepareHeaders` Bearer injection + error-shape
  transform (ADR-005).
- `src/services/api/endpoints.test.js` — store-integration: transaction filter URL building, vault
  allocate/withdraw URL+body, and a `'Balance'` invalidation→refetch probe.

### Relevant Documentation — READ BEFORE IMPLEMENTING

- Expo — "Unit testing with Jest" (jest-expo setup, `transformIgnorePatterns`):
  https://docs.expo.dev/develop/unit-testing/
  - Section: install (`jest-expo`, `@testing-library/react-native`) + the `jest` block with `preset`
    and the `transformIgnorePatterns` allow-list. Why: canonical managed-app jest config.
- React Native Testing Library — Getting Started / API:
  https://callstack.github.io/react-native-testing-library/docs/start/quick-start
  - Why: v14 ships its own jest matchers (auto-extended on import); no separate `extend-expect`.
- RTK Query — testing & cache behavior:
  https://redux-toolkit.js.org/rtk-query/usage/testing
  - Section: "Testing with a real store" + `store.dispatch(api.endpoints.X.initiate(arg))`. Why: pattern
    for the seam tests (initiate an endpoint, await, inspect mocked fetch + selectors).
- Luxon — formatting & zones (`DateTime.fromISO`, `toLocaleString`, `Settings.defaultZone`):
  https://moment.github.io/luxon/#/formatting
  - Why: make `dates.test.js` deterministic across machines/CI (pin zone + locale).

### Patterns to Follow

**Test framework & layout** (from `employee-mobile-app`, adapted for managed Expo):
- Jest config in `package.json`'s `jest` key (not a separate `jest.config.js`).
- Tests colocated next to source as `*.test.js`.
- `@testing-library/react-native` for any render-level test; `jest.fn()` for mocks; `beforeEach` →
  `jest.clearAllMocks()`.
- `npm test` and `npm run coverage` scripts.

**RTK Query seam test pattern** (MIRROR `src/store/index.js` wiring):
```js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import '../api'; // or import './index' — registers every injectEndpoints()
import authReducer from '../../reducers/auth';

const makeStore = (preloadedAuth) =>
  configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer }),
    preloadedState: { auth: preloadedAuth },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
  });

// global.fetch is mocked; the RN whatwg-fetch globals (Request/Response/Headers) come from jest-expo.
const store = makeStore({ token: null, user: null, bypass: true, bootstrapped: true });
await store.dispatch(balanceApi.endpoints.getBalance.initiate());
const req = global.fetch.mock.calls[0][0];        // a Request object
expect(req.headers.get('Authorization')).toBe('Bearer bypass-placeholder-token');
expect(req.url).toContain('/balance');
```

**Error-shape assertion pattern** (ADR-005): mock fetch to resolve a non-2xx JSON body and read the
RTK Query result:
```js
const res = await store.dispatch(balanceApi.endpoints.getBalance.initiate());
expect(res.error.message).toBe('Insufficient funds'); // from { error: 'Insufficient funds' }
```

**Pure util pattern** (from `TimeConverter.test.js`): `describe` per function, `test`/`it` per case,
table-style `expect(fn(input)).toBe(expected)`; cover happy path, fallback, and edge/falsy inputs.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (deps + config)

Install dev dependencies and add the `jest-expo` config so `npm test` runs. Verify the runner boots
(zero tests is fine) before writing tests.

### Phase 2: Pure-logic tests

`money.test.js` and `dates.test.js` — no store, no mocks beyond luxon zone/locale pinning. These prove
the toolchain end-to-end with the lowest-risk subjects.

### Phase 3: Seam tests

`auth/index.test.js` (reducer + selectors), then the store-integration tests `baseApi.test.js` and
`endpoints.test.js` (mocked `global.fetch`).

### Phase 4: Validation

Run `npm test` + `npm run coverage`; confirm `npx expo-doctor` and
`npx expo-modules-autolinking verify -v` still report only SDK native modules (jest-expo is a devDep →
must not introduce a native module; ADR-003).

---

## STEP-BY-STEP TASKS

Execute in order, top to bottom. Validate after each.

### UPDATE `package.json` — add devDeps + scripts + `jest` config block

- **IMPLEMENT**:
  - Add devDependencies: `jest-expo@~56.0.5`, `jest@^29.7.0`, `@testing-library/react-native@^14.0.1`,
    `react-test-renderer@19.2.0`.
  - Add script: `"coverage": "jest --coverage"` (keep existing `"test": "jest"`).
  - Add a top-level `"jest"` block:
    ```json
    "jest": {
      "preset": "jest-expo",
      "setupFilesAfterEnv": ["<rootDir>/jest.setup.js"],
      "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$",
      "transformIgnorePatterns": [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@reduxjs/toolkit|redux-persist|immer|reselect))"
      ]
    }
    ```
- **PATTERN**: `employee-mobile-app/package.json` `jest` block (same keys), but `preset: jest-expo` here.
- **IMPORTS**: n/a (config).
- **GOTCHA**: Install with `npm install -D <pkgs>`; `.npmrc` `legacy-peer-deps=true` already prevents the
  jest-expo peer (`react-server-dom-webpack`, `@react-native/jest-preset`) from blocking the install —
  do **not** add those peers unless a test actually needs RSC. Do NOT create a separate `jest.config.js`
  (keep single source of truth in `package.json`). Do NOT edit `babel.config.js`.
- **VALIDATE**: `npm install` (or `npm i -D jest-expo@~56.0.5 jest@^29.7.0 @testing-library/react-native@^14.0.1 react-test-renderer@19.2.0`) then `npx jest --listTests` (should exit 0, list nothing yet).

### CREATE `jest.setup.js` (repo root)

- **IMPLEMENT**: Minimal setup. jest-expo already auto-mocks Expo modules, so no `expo-modules-core`
  mock is needed (unlike `employee-mobile-app`). Optionally silence a known-noisy luxon/RN warning. A
  valid minimal file is a no-op comment; only add mocks a test actually requires.
- **PATTERN**: `employee-mobile-app/jest.setup.js` (concept: a `setupFilesAfterEnv` file) — but ours is
  near-empty because the managed preset does the Expo mocking.
- **IMPORTS**: none required initially.
- **GOTCHA**: Do not `jest.mock('expo-secure-store')` globally here — none of the in-scope tests import
  it; add module mocks per-test-file where needed to keep the global surface small.
- **VALIDATE**: `npx jest --listTests` still exits 0.

### CREATE `src/utils/money.test.js`

- **IMPLEMENT**: `describe('formatMoney')` with cases: default currency formats `1234.5` (assert it
  contains `1,234.50` and a `$` — keep assertions tolerant of `Intl` spacing); `null`/`undefined` →
  formats `0`; explicit `'EUR'`; **fallback path**: an invalid currency code (e.g. `'XX'` or `'ZZZ'`)
  triggers the `catch` and returns `` `XX 12.00` `` shape — assert `toBe('XX 12.00')` for `formatMoney(12,'XX')`.
- **PATTERN**: `employee-mobile-app/utils/TimeConverter/TimeConverter.test.js` (describe + table cases).
- **IMPORTS**: `import { formatMoney } from './money';`
- **GOTCHA**: Node 24's full-ICU may format an unknown but *well-formed* 3-letter code without throwing;
  to reliably hit the `catch`, pass a malformed code like `'XX'` (too short → `RangeError`). Don't
  hard-assert exact `Intl` output for valid currencies across ICU versions — assert substrings.
- **VALIDATE**: `npx jest src/utils/money.test.js`

### CREATE `src/utils/dates.test.js`

- **IMPLEMENT**: Pin determinism at top: `import { Settings } from 'luxon';` then
  `Settings.defaultZone = 'utc'; Settings.defaultLocale = 'en-US';` (in a `beforeAll`). Cases:
  `formatDate('')` and `formatDateTime(undefined)` → `''`; `formatDate('2026-06-27')` →
  `toBe('Jun 27, 2026')`; `formatDateTime('2026-06-27T15:30:00Z')` → assert it contains `Jun 27, 2026`
  (UTC-pinned → local == UTC); `todayISODate()` matches `/^\d{4}-\d{2}-\d{2}$/`.
- **PATTERN**: pure-util describe/case style.
- **IMPORTS**: `import { todayISODate, formatDate, formatDateTime } from './dates';` + luxon `Settings`.
- **GOTCHA**: Without pinning `Settings.defaultZone`/`defaultLocale`, `toLocaleString(DATE_MED)` and the
  UTC→local conversion are machine-dependent and will flake in CI. Restore defaults in `afterAll` if
  other suites depend on them (each file is isolated, so optional).
- **VALIDATE**: `npx jest src/utils/dates.test.js`

### CREATE `src/reducers/auth/index.test.js`

- **IMPLEMENT**: Two `describe`s.
  - **Reducer/actions** (mock config so `initialState.bypass` is deterministic): at top
    `jest.mock('../../utils/config', () => ({ Config: { AUTH_BYPASS: true } }));` then
    `const reducer = require('./index').default;` / `const { hydrateAuth, setToken, clearAuth } = require('./index');`
    (use `require` after the mock, or `jest.mock` is hoisted so ESM imports also work). Cases:
    `hydrateAuth({ token:'t', user:{id:1} })` sets `token`,`user`,`bootstrapped:true`;
    `hydrateAuth({})` → `token:null`,`user:null`,`bootstrapped:true`; `setToken('x')` sets token;
    `clearAuth()` nulls token+user (leaves `bootstrapped`).
  - **Selectors** (pure, no config mock needed — they take `state`): build plain state objects:
    `selectToken({ auth:{ token:null, bypass:true } })` → `'bypass-placeholder-token'`;
    `selectToken({ auth:{ token:'real', bypass:true } })` → `'real'`;
    `selectToken({ auth:{ token:null, bypass:false } })` → `null`;
    `selectIsAuthed({ auth:{ token:null, bypass:true } })` → `true`;
    `selectIsAuthed({ auth:{ token:null, bypass:false } })` → `false`;
    `selectBootstrapped({ auth:{ bootstrapped:true } })` → `true`.
- **PATTERN**: `employee-mobile-app/reducers/ClockInWorkLocationsUtils.test.js` (reducer-util style).
- **IMPORTS**: from `./index` (after the `jest.mock` for the reducer half).
- **GOTCHA**: `PLACEHOLDER_TOKEN` is `'bypass-placeholder-token'` — assert that exact string. The slice
  reads `Config.AUTH_BYPASS` **at module load** for `initialState` only; selectors read `state.auth.bypass`
  directly, so don't conflate the two. Keep the literal in sync if the source ever changes.
- **VALIDATE**: `npx jest src/reducers/auth/index.test.js`

### CREATE `src/services/api/baseApi.test.js`

- **IMPLEMENT**: Store-integration for the two ADR-005 behaviors.
  - Helper `makeStore(auth)` mirroring `src/store/index.js` (see Patterns). Import the api barrel
    (`import '.'` or `import './index'`) so endpoints register; import `balanceApi`/`baseApi`.
  - `beforeEach`: `global.fetch = jest.fn();` ... `afterEach: jest.resetAllMocks()`.
  - **prepareHeaders / auth seam**: mock fetch → resolve `new Response(JSON.stringify({total:0}), { status:200, headers:{'content-type':'application/json'} })`. Dispatch
    `getBalance.initiate()`; read `global.fetch.mock.calls[0][0]` (Request) →
    `.headers.get('Authorization')` is `'Bearer bypass-placeholder-token'` when store auth is
    `{ bypass:true, token:null }`; and `'Bearer realtoken'` when `{ bypass:false, token:'realtoken' }`;
    and **no** Authorization header when `{ bypass:false, token:null }`.
  - **error-shape transform**: mock fetch → `new Response(JSON.stringify({ error:'Insufficient funds' }), { status:400, headers:{'content-type':'application/json'} })`. Await the dispatch result; assert
    `result.error.message === 'Insufficient funds'`. Second case: body `{}` with status 500 →
    `result.error.message === 'Request failed (500)'`.
- **PATTERN**: RTK Query "testing with a real store" + the seam snippet in Patterns above.
- **IMPORTS**: `configureStore, combineReducers` from `@reduxjs/toolkit`; `baseApi` + `balanceApi`;
  `authReducer` from `../../reducers/auth`; the api barrel for registration.
- **GOTCHA**: `fetchBaseQuery` constructs a `Request` and uses `Headers` — these globals come from RN's
  whatwg-fetch shim that **jest-expo includes**, so they exist without extra polyfills; you only mock
  `global.fetch` itself. The mocked fetch arg is a **Request object** (`calls[0][0]`), not a URL string —
  read `.url`/`.headers`. `baseUrl` is `undefined` (no `expo-constants` extra in tests) so assert
  `req.url` **contains** `/balance` rather than a full origin. Always `await` the dispatch (it returns a
  promise with `.unwrap()` available, but read `.error`/`.data` off the resolved object — do not
  `.unwrap()` the error case or it throws).
- **VALIDATE**: `npx jest src/services/api/baseApi.test.js`

### CREATE `src/services/api/endpoints.test.js`

- **IMPLEMENT**: Store-integration for URL/body building + invalidation wiring.
  - **transactions filter URL**: dispatch `transactionsApi.endpoints.getTransactions.initiate({ type:'expense', category_id: 2, description: '' })`; assert the Request URL contains
    `type=expense` and `category_id=2` and does **not** contain `description` (empty string dropped).
    Also `getTransactions.initiate({})` → URL ends with `/transactions` (no `?`).
  - **vault action body/URL**: dispatch `vaultsApi.endpoints.allocateVault.initiate({ id: 3, amount: 50 })`;
    assert Request URL contains `/vaults/3/allocate`, method `POST`, and the JSON body is `{ amount: 50 }`
    (read via `await req.json()` on the cloned Request, or assert on the fetch-mock call body).
  - **invalidation probe (`'Balance'`)**: prime `getBalance` (dispatch initiate, await), then dispatch
    `addTransaction.initiate({ type:'income', amount:10 })` (mock fetch resolves 201). Assert that the
    balance endpoint gets re-fetched — e.g. `global.fetch` is called again with a `/balance` URL after
    the mutation (filter `global.fetch.mock.calls` for a `/balance` request count > 1), confirming
    `invalidatesTags:['Balance']` wiring.
- **PATTERN**: same store helper; RTK Query `initiate` + tag invalidation behavior.
- **IMPORTS**: `transactionsApi`, `vaultsApi`, `balanceApi` (from their files or the barrel).
- **GOTCHA**: Reading a `Request` body twice consumes the stream — `clone()` before `.json()`, or assert
  the body from the fetch-mock you control rather than the Request. The invalidation refetch is async
  (RTK Query schedules it) — `await` a tick (e.g. `await new Promise(r => setTimeout(r, 0))`) or await
  the mutation's promise before asserting the second `/balance` call. Keep `refetchOnMountOrArgChange`
  in mind: it's already `true` in `baseApi`, so re-initiating a query refetches; rely on the tag
  invalidation path, not a manual refetch, to prove the wiring.
- **VALIDATE**: `npx jest src/services/api/endpoints.test.js`

### UPDATE `.claude/ADR/ADR-010-...md` Follow-ups + force-add plan/tests

- **IMPLEMENT**: No content edit required, but **force-add** the new plan and (after creation) the test
  files are NOT under `.claude` so they're tracked normally; only `.claude/**` is gitignored. Force-add
  this plan file: `git add -f .claude/agents/plans/001-jest-test-suite.md`.
- **PATTERN**: project memory note — `.gitignore` line 39 `/.claude*` hides ADRs/plans; force-add.
- **VALIDATE**: `git status --short` shows the plan staged and the `src/**/*.test.js` files tracked.

---

## TESTING STRATEGY

### Unit Tests
- `money.test.js`, `dates.test.js` — pure functions; happy path + fallback + falsy/edge inputs;
  deterministic luxon zone/locale.
- `auth/index.test.js` — reducer transitions + every selector branch (bypass×token matrix).

### Integration Tests (store-level, no network)
- `baseApi.test.js` — auth-header injection across the bypass/real/none matrix; backend error-body
  normalization (`{ error }`, `{ message }` absent → fallback string).
- `endpoints.test.js` — query-string construction (filter omission), action URL+body, and `'Balance'`
  tag invalidation→refetch.

### Edge Cases (must be covered)
- `formatMoney(null)` / `formatMoney(undefined)` → treated as `0`.
- `formatMoney(x, 'XX')` malformed currency → `catch` fallback `"XX 0.00"`-style.
- `formatDate('')` / `formatDateTime(null)` → `''`.
- `selectToken` with `bypass:true, token:null` → placeholder; `bypass:false, token:null` → `null`.
- `prepareHeaders` with no token and no bypass → header absent (not `Bearer null`).
- Error body `{}` → `"Request failed (<status>)"`.
- `getTransactions` drops `''`/`null`/`undefined` filter values from the query string.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
- `npx jest --listTests` — config parses, files are discovered.
- (No ESLint/Prettier configured in this repo; skip unless one is added.)

### Level 2: Unit Tests
- `npx jest src/utils` — pure-logic suites green.

### Level 3: Integration Tests
- `npx jest src/reducers src/services` — seam suites green.

### Level 4: Full suite + coverage
- `npm test`
- `npm run coverage` — confirm the in-scope files report coverage (money/dates/auth/baseApi/endpoints).

### Level 5: Expo-Go / prebuild compatibility (ADR-003 guard)
- `npx expo-doctor`
- `npx expo-modules-autolinking verify -v` — confirms only SDK native modules are linked; jest-expo is a
  devDep and must not appear as a native module. (No `android/ios` should be generated.)

---

## ACCEPTANCE CRITERIA

- [ ] `npm test` runs jest with the `jest-expo` preset and all suites pass.
- [ ] `npm run coverage` works and reports coverage for money/dates/auth/baseApi/endpoints.
- [ ] `formatMoney` Intl + fallback paths covered; `dates` helpers deterministic (zone/locale pinned).
- [ ] Auth slice reducer + all `selectToken`/`selectIsAuthed`/`selectBootstrapped` branches covered.
- [ ] `prepareHeaders` asserts Bearer injection for bypass/real/none; error-shape maps `{ error }` and
      the `(status)` fallback.
- [ ] Transaction filter URL omits empty values; vault allocate posts `{ amount }` to the right URL;
      `'Balance'` invalidation triggers a `/balance` refetch.
- [ ] `npx expo-modules-autolinking verify -v` still lists only SDK native modules (ADR-003 holds); no
      `android/ios` committed.
- [ ] No product code changed (tests target as-built code); plan force-added under `.claude`.

## COMPLETION CHECKLIST

- [ ] devDeps installed; `package.json` `jest` block + `coverage` script added.
- [ ] `jest.setup.js` created (minimal).
- [ ] 5 test files created and individually green.
- [ ] `npm test` + `npm run coverage` pass end-to-end.
- [ ] ADR-003 native-module guard re-verified.
- [ ] Plan force-added; tests tracked by git.

## NOTES

- **Why `jest-expo`, not the `employee-mobile-app` `react-native` preset:** ADR-010. The bare preset
  needs a hand-written `expo-modules-core` mock; the managed preset auto-mocks Expo and tracks the SDK.
  After `npx expo prebuild` the app is *still* an Expo app, so this config is unchanged; only a full
  de-Expo (drop the `expo` package) would flip the single `preset` line — see ADR-010 "Boundary".
- **Why store-integration over mocking `prepareHeaders` directly:** `prepareHeaders` and the error
  transform are closures inside `baseApi.js` (not exported). Driving them through a real store + mocked
  `global.fetch` tests the actual seam behavior without exporting internals or refactoring product code.
- **Scope discipline:** screen/render tests and `msw` API integration are deferred (ADR-010 north star).
  Do not add them here; do not refactor product code to raise coverage.
- **Confidence score: 8/10** for one-pass success. Main risks: (1) exact `Intl`/luxon output strings
  across ICU/Node versions — mitigated by substring assertions + pinned luxon Settings; (2) the RTK
  Query invalidation→refetch timing in `endpoints.test.js` — mitigated by awaiting a tick; (3) whether
  the `Request`/`Headers` globals are present — they ship with jest-expo's RN whatwg-fetch shim, but if
  a particular environment lacks them, add `import 'whatwg-fetch';` (already a RN dep) to `jest.setup.js`.
