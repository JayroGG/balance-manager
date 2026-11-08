# ADR-010 — Testing: Jest with the `jest-expo` preset (not bare `react-native`)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Jayro Gómez + mobile agent
- **Supersedes / Related:** realizes PRD §5 (testing row) & §9 Phase-1; constrained by ADR-003
  (Expo managed-first / Expo-Go-safe); tests the seams from ADR-001 (auth) and ADR-005 (RTK Query).

## Context

The prototype shipped with `npm test` wired to `jest` but **no jest config, no preset, and zero
tests**. We want a test suite, and Jayro is already comfortable with the Jest setup in
`employee-mobile-app`. But that app is a **bare** React Native project, and its config does not
transfer cleanly:

- `employee-mobile-app` uses `preset: 'react-native'` and then **hand-mocks Expo** — a custom
  `__mocks__/expo-modules-core.js` (stubbing `requireNativeModule`, `EventEmitter`, `uuid`, …) plus a
  manual `transformIgnorePatterns` allow-list and an async-storage mock. That scaffolding exists
  precisely *because* the bare RN preset knows nothing about Expo modules.
- `balance-mobile` is **Expo SDK 56 managed (CNG)** and leans on Expo modules at exactly the points
  worth testing: `expo-constants` (`utils/config.js`), `expo-secure-store` (`services/storage`),
  `expo-localization` (i18n), expo-router. Reusing the bare preset would mean re-deriving all of
  Expo's mocking by hand and keeping it in sync with the SDK.

The hard constraint is **ADR-003**: the MVP must stay Expo-Go-compatible and prebuild-on-demand, so
we cannot introduce a non-SDK **native** module. A test runner is not a native module — but the
decision still has to respect that line and stay a pure dev-time concern.

## Decision

Adopt the **Expo-official `jest-expo` preset** — the modern, supported path for an Expo managed app —
while keeping every convention Jayro already uses in `employee-mobile-app`.

- **Now (MVP):**
  - `jest-expo@~56.0.5` (tracks the SDK 56 line) as the Jest **preset**. It ships Expo's
    `transformIgnorePatterns`, transforms, and **auto-mocks for Expo modules**, so we do *not*
    hand-write an `expo-modules-core` mock. jest-expo@56 requires its RN preset peer to be installed
    explicitly: **`@react-native/jest-preset@^0.85`** (matches RN 0.85).
  - Keep the familiar toolbelt: **`@testing-library/react-native` v13** (`react-test-renderer`-based;
    v14's new `test-renderer@1` universal renderer did not mount under jest-expo here, so we pinned
    v13.3.x), with **`react-test-renderer` pinned to React's exact version (19.2.3)** — RNTL v13
    asserts an exact match — colocated **`*.test.js`/`*.test.jsx`** next to source, a root
    **`jest.setup.js`** (`setupFilesAfterEnv`), and `npm test` / `npm run coverage`.
  - Extend jest-expo's `transformIgnorePatterns` to also transform the data-layer ESM packages we
    import in seam tests (`@reduxjs/toolkit`, `react-redux`, `redux-persist`, `immer`, `reselect`).
  - Jest config lives in `package.json`'s `jest` key (same place as `employee-mobile-app`).
  - **Scope = pure logic + the seams**, which is where a thin client earns its tests and where the
    suite stays stable: `utils/money.js`, `utils/dates.js`, the `auth` slice + `selectToken`
    placeholder logic (ADR-001), `baseApi`'s error-shape transform + `prepareHeaders` (ADR-005),
    and the RTK Query tag/endpoint wiring. Heavy screen/render tests are deferred (see north star).
  - All Expo/native touchpoints are mocked at the seam (secure-store, constants, localization), never
    reached for real — consistent with how `services/storage` and `utils/config` isolate them.
- **North star (deferred):** component/screen render tests via `@testing-library/react-native` once
  screens stabilize, and `msw`-style API integration tests over RTK Query. When a **dev build** is
  introduced (ADR-003/006 — e.g. MMKV, Auth0), `jest-expo` still applies unchanged; only the new
  native module gets a mock.
- **Boundary:** `jest-expo` is a **devDependency** and a *test-time* transform/preset only. It adds
  **no** runtime dependency and **no** native module, so it is fully compatible with Expo Go today and
  with `npx expo prebuild` later — ADR-003 holds. Two scenarios to keep straight:
  - **After `npx expo prebuild` (still an Expo app):** works **unchanged**. Prebuild only *generates*
    `android/ios`; it does not remove the `expo` package or Expo modules. A prebuilt app is still an
    Expo app run via `expo-dev-client` (the managed→dev-build path, ADR-003), and `jest-expo` targets
    that JS/Expo layer, which prebuild leaves intact. This is the supported, trajectory-aligned case.
  - **Fully "pure" React Native (the `expo` package removed entirely):** only reachable by abandoning
    Expo — which ADR-003 does **not** plan. If it ever happened, `jest-expo` (which peers on `expo`
    and auto-mocks Expo modules) is no longer the right preset: change the **single** `"preset"` line
    to `react-native` / `@react-native/jest-preset` and restore manual native mocks — i.e. land exactly
    on the `employee-mobile-app` config. The tests target seams, not Expo internals, so they survive
    the swap.

## Consequences

- **Positive:** zero hand-rolled Expo mocking to maintain; the preset moves in lockstep with the SDK
  on upgrade; tests read like `employee-mobile-app`'s (same library, same file convention) so the
  muscle memory carries over; the highest-value, lowest-churn code (money math, the auth seam, the
  error-shape contract) is covered first.
- **Negative / trade-offs:** a second Jest dialect across the two repos (bare `react-native` preset
  there, `jest-expo` here) — accepted, because it is the correct preset for each project type and
  ADR-003 already establishes that `balance-mobile` is deliberately *not* a clone of the bare app.
  We also defer render/integration tests rather than chase coverage on still-moving screens.
- **Follow-ups:** implementation plan in `.claude/agents/plans/001-jest-test-suite.md` (executed —
  39 tests across utils/auth/baseApi/endpoints + functional component tests). devDeps as shipped:
  `jest-expo@~56.0.5`, `@react-native/jest-preset@^0.85`, `@testing-library/react-native@^13.3`,
  `react-test-renderer@19.2.3`, `jest@^29`. Seam tests drive a real store with a single stable
  `global.fetch` mock (installed in `jest.setup.js` before imports, since `fetchBaseQuery` captures
  `fetch` at construction) returning a **fresh `Response` per call** (bodies read once) and an
  absolute `API_URL` (Node's `Request` rejects relative URLs). Force-add new `.claude/` files (the dir
  is gitignored); `/coverage` is gitignored.

## Alternatives considered

- **Copy `employee-mobile-app` verbatim (`preset: 'react-native'` + manual `expo-modules-core` mock).**
  Rejected: re-implements what `jest-expo` gives for free and drifts from the Expo SDK on every
  upgrade; the manual mock list is exactly the maintenance burden the managed preset removes.
- **No preset / plain `babel-jest` + bespoke `transformIgnorePatterns`.** Rejected: we'd reinvent
  Expo's transform allow-list and module mocks by trial and error — brittle and Expo-version-coupled.
- **Vitest.** Rejected for now: not the standard path for React Native / Expo (RN's Metro + Flow-typed
  internals expect the Jest + babel-preset-expo pipeline); breaks parity with `employee-mobile-app`
  for no MVP gain.
