# ADR-006 — Storage: secure-store + AsyncStorage now, MMKV north star

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Refines PRD §5 (which listed only AsyncStorage). Related: ADR-003 (Expo Go
  vs dev build), ADR-001 (token).

## Context

We need persistence for two different things with different requirements:
1. the **auth token** — a small secret that should be encrypted at rest;
2. **non-secret cache/prefs** — active environment, language preference, small cached values.

`react-native-mmkv` is the fastest option (synchronous, ~30× faster than AsyncStorage) and is what the
team wants to adopt — but it is a **non-SDK native module**, so it **cannot run in Expo Go** and would
force a dev build (ADR-003). The prototype is intentionally Expo-Go-compatible. We therefore choose
Expo-Go-safe storage now and keep MMKV as a recorded, low-cost-to-adopt target.

## Decision

One storage seam in `src/services/storage/`, two backends:

- **`secure.js` — `expo-secure-store`** (in the Expo SDK, Expo-Go safe, OS keychain/keystore-backed):
  `getToken / setToken / clearToken`. The token lives here only; the `auth` slice reads it at boot
  (ADR-001).
- **`prefs.js` — `@react-native-async-storage/async-storage`** (Expo-Go safe): active environment,
  `lng_preference`, and generic `getKey/setKey/removeKey`. Mirrors `employee-mobile-app`'s
  `services/AsyncStorage` API so it's familiar and swappable.

- **North star (deferred):** **`react-native-mmkv`** replaces `prefs.js`'s backend (and optionally backs
  RTK Query persistence) once the app moves to a dev build. Because everything goes through the
  `services/storage` wrapper, the swap is a **one-file change** — call sites don't move. Secrets stay in
  `expo-secure-store` regardless (don't put the token in MMKV).

## Consequences

- **Positive:** Expo-Go-compatible today; token encrypted at rest; cache/prefs API matches the team's
  existing wrapper; MMKV is a drop-in upgrade behind the seam.
- **Positive:** clean separation of "secret" vs "fast cache" storage — the recommended modern split.
- **Negative / trade-offs:** AsyncStorage is async and slower than MMKV; acceptable for the tiny amount
  of prototype persistence (RTK Query holds the real data cache in memory).
- **Follow-ups:** when adopting a dev build (e.g. for Auth0/MMKV), swap `prefs.js` to MMKV and
  benchmark; record a relating ADR if the wrapper API changes.

## Alternatives considered

- **MMKV now.** Rejected: forces a dev build immediately (ADR-003) for negligible benefit on a few small
  keys; kept as the north star.
- **AsyncStorage for everything (incl. token), per PRD §5.** Rejected: the token shouldn't be stored
  unencrypted; `expo-secure-store` is Expo-Go safe and purpose-built.
- **`expo-sqlite` kv-store.** Rejected for now: heavier than needed for a handful of keys; AsyncStorage
  is simpler and already team-familiar.
