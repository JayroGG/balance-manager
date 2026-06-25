# ADR-003 — Expo managed-first, prebuild-on-demand (RN template baseline)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Amends PRD §5 (which assumed a bare/`react-native-config` setup like
  `employee-mobile-app`). Template baseline for **all future RN apps**.

## Context

`employee-mobile-app` is **bare** (committed `android/ios`, `react-native-config`, manual Xcode/Gradle
builds). That's heavier to maintain and pins you to native folders even before you need any custom
native code. `balance-mobile`'s prototype currently needs **zero** non-SDK native modules (no Auth0 yet
— auth is bypassed). Modern Expo (SDK 56) supports **Continuous Native Generation (CNG)**: you don't
commit `android/ios`; `npx expo prebuild` (or EAS) regenerates them on demand.

Crucial distinction the team must keep straight: **"managed" ≠ "Expo Go."** Managed means no committed
native folders; you can still use any native module — you just run the app in a **dev build**
(`expo-dev-client`) instead of Expo Go once a non-SDK native module is added.

## Decision

- **Now (MVP):** **managed (CNG), Expo-Go-compatible.** Use only Expo-SDK native modules
  (`expo-router`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-splash-screen`,
  `expo-localization`, `expo-constants`) plus pure-JS libs (RTK Query, luxon, i18next). No `android/ios`
  in git. Run with `npx expo start` → Expo Go.
- **North star / prebuild-on-demand:** the moment a feature needs a non-SDK native module (MMKV →
  ADR-006; Auth0 → ADR-001; analytics SDKs; etc.), run `npx expo prebuild` and switch to a **dev build**
  (`expo-dev-client`, or `eas build --profile development`). This is a config step, not a rewrite,
  because storage/auth/config sit behind seams.
- **Env (consequence of managed):** config comes from **`app.config.js` + `expo-constants`**, loading
  `.env.dev/.env.stage/.env.prod` via `dotenv`, exposed under `extra` and read through
  `src/utils/config.js`. We do **not** use `react-native-config` (it's a native module that breaks Expo
  Go and fights CNG).
- **Builds:** `eas.json` carries profiles — `development` (`developmentClient: true`, dev env),
  `preview` (stage), `production` (prod) — for when we leave Expo Go.

## Consequences

- **Positive:** lightest possible repo and fastest iteration for the prototype; no native folder upkeep;
  the bare/prebuild path Jayro is comfortable with is one command away, not abandoned.
- **Positive:** establishes one consistent baseline for every future RN app.
- **Negative / trade-offs:** the Expo Go ↔ dev-build line is a rule the team must respect — adding a
  forbidden native module without prebuilding will crash Expo Go. Documented in `CLAUDE.md`.
- **Follow-ups:** when the first dev build is needed, write a short plan, run prebuild, wire `eas.json`,
  and (if relevant) note it in a superseding/relating ADR.

## Alternatives considered

- **Bare, mirroring `employee-mobile-app` exactly.** Rejected for a greenfield prototype: commits native
  folders and `react-native-config` before any native code is needed; heavier with no MVP benefit.
- **Commit to a dev build from day one (drop Expo Go).** Rejected for MVP: buys nothing yet (no native
  modules needed) and slows the inner loop; revisit when MMKV/Auth0 land.
