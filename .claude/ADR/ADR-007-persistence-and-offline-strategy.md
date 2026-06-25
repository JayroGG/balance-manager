# ADR-007 — Persistence & offline: cache-persist now, local-first sync north star

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Refines PRD §3 (offline listed as a non-goal) and PRD §9 Phase 3. Related:
  ADR-005 (RTK Query), ADR-006 (storage), ADR-003 (Expo Go vs dev build).

## Context

The prototype as first planned is **online-first**: RTK Query keeps an in-memory cache, so a cold start
shows nothing until the first fetch returns, and the app is unusable with no network. Jayro wants (a)
better cold starts and (b) eventually a **local-first** app that works offline and syncs when the server
is reachable. Full local-first is a substantial feature and also needs **backend** support (delta sync,
conflict resolution) that does not exist yet, so it cannot be the MVP — but the seams should make it cheap.

Three tiers exist; we pick the middle now and record the top as the target:
1. online-first (no persistence);
2. **cache persistence** — persist the read cache so cold starts paint instantly, then revalidate;
3. **local-first** — local DB as source of truth + mutation outbox + background sync + conflict handling.

## Decision

- **Now (MVP): tier 2 — cache persistence via `redux-persist` (AsyncStorage backend).**
  - Persist the **RTK Query `api` reducer only**; rehydrate it behind a `PersistGate` during the
    cold-start bootstrap (alongside the splash gate).
  - Configure RTK Query with `refetchOnMountOrArgChange` and `refetchOnReconnect: true` so persisted
    data is shown immediately, then revalidated when online.
  - **Do not persist the `auth` slice / token via redux-persist** — the token stays in `expo-secure-store`
    (ADR-006) and is rehydrated separately in the bootstrap. No secrets in AsyncStorage.
  - Pure JS, **Expo-Go safe**, fits the existing RTK Query + storage seams. Result: instant cold-start
    paint and offline **reads** (stale-but-visible); writes still require the network.

- **North star (deferred): tier 3 — local-first with offline writes + sync.**
  - Local DB as source of truth using **`expo-sqlite`** (note: it is an Expo-SDK module, so this stays
    **Expo-Go compatible** — no forced dev build, unlike MMKV/Auth0). Optionally evaluate a sync engine
    (WatermelonDB / PowerSync / Legend-State) — most of those *do* need a dev build, decide then.
  - A **mutation outbox**: queue create/update/delete while offline, replay on reconnect, reconcile with
    server responses; resolve conflicts using the backend's `updated_at` (requires backend delta-sync +
    conflict strategy — a parallel backend ADR/plan).
  - Because data access already goes through RTK Query hooks (ADR-005) and storage through the
    `services/storage` seam (ADR-006), introducing a local DB + outbox swaps the data source behind the
    same hooks rather than rewriting screens.

## Consequences

- **Positive:** cold starts feel instant and the app degrades gracefully offline (reads) today, for a
  small, low-risk, Expo-Go-safe addition.
- **Positive:** the ambitious local-first target is on record with a concrete, seam-friendly path and the
  key insight that `expo-sqlite` keeps it Expo-Go-compatible.
- **Negative / trade-offs:** persisted cache can be stale or hold a schema that changed — use a
  `redux-persist` version/migration and a cache-clear in Settings. Tier 3 is real work and is explicitly
  **not** in the MVP; it also blocks on backend sync support.
- **Follow-ups:** (1) wire `redux-persist` + `PersistGate` in the store/bootstrap; (2) add a "clear cache"
  action; (3) when tier 3 starts, write `.claude/agents/plans/` entries for both app and backend and a
  superseding ADR.

## Alternatives considered

- **Stay online-first (PRD default).** Rejected: poor cold start and zero offline tolerance; tier 2 fixes
  both cheaply.
- **Jump straight to local-first now.** Rejected for MVP: large scope, needs nonexistent backend sync
  endpoints and conflict handling; high risk for a prototype. Kept as the north star.
- **Persist everything incl. token.** Rejected: secrets must not live in AsyncStorage (ADR-006).
