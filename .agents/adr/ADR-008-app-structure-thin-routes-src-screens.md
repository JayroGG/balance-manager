# ADR-008 — App structure: thin `app/` routes, `src/screens`, atomic `src/components/ui`

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Related: ADR-004 (expo-router). Template baseline for future RN apps.

## Context

expo-router requires a folder named `app/` at the project root: every file in it is a navigable route.
The first implementation put **entire screen UIs inside the `app/` route files** and kept only a thin
`ui.jsx` of primitives. Two problems: (1) one mega-file for all UI primitives invites merge conflicts and
can't be worked on in isolation; (2) the real domain UI was trapped inside route files, so `src/` looked
empty of components and the "what is a route vs a screen vs a component" boundary was muddy. The team's
`employee-mobile-app` already separates top-level `screens/` and `components/` (category folders, each
with per-component files + an `index` barrel), which is also what 2026 RN guidance recommends
(atomic design + feature colocation).

## Decision

Three explicit layers:

- **Route (`app/`)** — expo-router's required folder, treated as a **navigation map only**. Each `(tabs)`
  screen file is a **one-line shim**: `export { default } from '../../src/screens/<Name>'`. The only real
  logic kept in `app/` is router infrastructure: the root `_layout.jsx` (providers + cold-start bootstrap
  + splash gate) and `index.jsx` (boot redirect). `app/` cannot move into `src/` — Expo scans it at root.
- **Screen (`src/screens/<Name>/`)** — the screen body: composition + data orchestration (RTK Query hooks,
  route params via expo-router hooks). Screen-local subcomponents and screen-specific pieces (e.g.
  `Transactions/TransactionForm.jsx`) colocate here. Testable without the router.
- **Component (`src/components/`)** — reusable UI. `components/ui/` holds shared **atoms/molecules**, one
  file per component (`Screen, Card, Button, Field, Chip, MoneyText, Typography, EmptyState,
  QueryBoundary`) + an `index.js` barrel; `theme.js` (colors/spacing/font) sits alongside. Domain
  "organism" components are extracted to `src/screens/<Name>/` (or a future `src/components/<Domain>/`)
  as they grow and are reused.

Data layer stays central in `src/services/api/` (ADR-005); storage in `src/services/storage/` (ADR-006).

## Consequences

- **Positive:** clear route→screen→component boundary; `app/` reads as a navigation map; UI primitives are
  individually editable (no mega-file conflicts); mirrors the team's existing layout and atomic design;
  screens are testable in isolation.
- **Positive:** modular — a screen folder is self-contained; deleting it + its route shim removes the
  feature.
- **Negative / trade-offs:** one extra hop (route shim → screen) — accepted as cheap indirection that buys
  testability and a clean `app/` tree. Verified the full bundle still builds after the move.
- **Follow-ups:** as features grow, extract recurring inline pieces (VaultCard, TransactionRow,
  BalanceHero, VaultHistoryItem, TxPicker) into named components under the screen folder.

## Alternatives considered

- **Keep screen bodies inside `app/` route files.** Rejected: couples screens to the router, makes them
  hard to test, and leaves `src/` looking empty of components.
- **Single `components/ui.jsx` mega-file.** Rejected: merge-conflict prone, can't be worked on in
  isolation — the original trigger for this ADR.
- **Full `src/features/<feature>/` (api + screens + components colocated).** Deferred: heavier nesting than
  warranted for 4 resources; `src/screens` + central `services/api` matches the team and is simpler now.
  Revisit if the app grows many features.
