# ADR-004 — Navigation via expo-router (supersedes PRD `stacks/`)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Supersedes PRD §5/§6 navigation (which prescribed React Navigation under
  `stacks/`, matching `employee-mobile-app`). Related: ADR-003.

## Context

`employee-mobile-app` organizes navigation by hand under `stacks/` (RootStack decides Auth vs App from
credentials, native-stack + bottom-tabs). The PRD inherited that. Expo's current default is
**expo-router** — file-based routing built **on top of React Navigation** (same native-stack/bottom-tabs
primitives). Jayro wanted to try file-based layouts, with two conditions: it must keep working across
prebuild, and it must not hurt performance.

## Decision

Use **expo-router** for all navigation. Routes live in `app/`:

```
app/
  _layout.jsx        # Root: Redux Provider, boot bootstrap (token+i18n), splash gate, <Stack/>
  index.jsx          # redirect → (tabs) when bypass/has-token, else (auth)
  (auth)/            # login flow (disabled in prototype)
  (tabs)/_layout.jsx # bottom tabs: Dashboard, Transactions, Vaults, Categories, Settings
  (tabs)/dashboard.jsx
  (tabs)/transactions/{index,[id],new}.jsx
  (tabs)/vaults/{index,[id]}.jsx
  (tabs)/categories.jsx
  (tabs)/settings.jsx
```

The Auth-vs-App decision (formerly `Stack.jsx`) becomes the root `_layout` bootstrap + `index.jsx`
redirect, driven by the `auth` slice (ADR-001).

## Consequences

- **Positive:** both Jayro's conditions are met — expo-router **runs in Expo Go** (it's an Expo SDK
  package), it is **React Navigation native-stack underneath** (no measurable performance regression),
  and it is **unchanged across `npx expo prebuild`**.
- **Positive:** file-based routes give deep-linking for free and a clearer route map than hand-wired
  navigators; the route tree doubles as documentation.
- **Negative / trade-offs:** diverges from `employee-mobile-app`'s `stacks/` muscle memory; screen
  files now live under `app/` (routes) while reusable UI/logic stays in `src/`. Mitigated by keeping all
  non-route code in `src/` so screens stay thin.
- **Follow-ups:** the Phase-2 `(auth)` login flow slots in as a route group with no change to `(tabs)`.

## Alternatives considered

- **React Navigation under `stacks/` (PRD/team default).** Rejected here in favor of trying file-based
  routing, since it's the same engine underneath with no perf cost and full Expo-Go/prebuild
  compatibility — low risk, and Jayro explicitly wanted to evaluate it.
