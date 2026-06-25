# Architecture Decision Records (ADR)

This directory is the **decision log** for `balance-mobile`. Each ADR captures one significant
architectural or product decision: the context, what we decided, and the consequences.

ADRs are **append-only and immutable**. We don't rewrite history — when a decision changes,
we add a new ADR that **supersedes** the old one and flip the old one's status to `Superseded`.

## Why we keep ADRs

- **Durable memory.** Six months later, "why did we do it this way?" has a written answer.
- **Aim high, ship lean.** We record the *north-star* decision even when the MVP deliberately
  bypasses it (e.g. "MMKV is the target; the prototype ships AsyncStorage"). The gap is
  intentional and documented, not forgotten.
- **Agent-friendly.** Any agent can read the log and understand the system's trajectory without
  re-deriving it from code.

## How to write one

1. Copy `ADR-000-template.md` to `ADR-NNN-short-kebab-title.md` (next free number).
2. Fill in Context → Decision → Consequences → Alternatives.
3. Set the status. Link related/superseded ADRs by filename.
4. Add a row to the index below.

Statuses: `Proposed` · `Accepted` · `Deprecated` · `Superseded by ADR-NNN`.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-auth-strategy.md) | Authentication as a modular client seam (bypass now, Auth0 + RBAC north star) | Accepted |
| [ADR-002](ADR-002-documentation-and-workflow-standard.md) | Documentation & agent-workflow standard | Accepted |
| [ADR-003](ADR-003-expo-managed-first-prebuild-on-demand.md) | Expo managed-first, prebuild-on-demand (RN template baseline) | Accepted |
| [ADR-004](ADR-004-navigation-expo-router.md) | Navigation via expo-router (supersedes PRD `stacks/`) | Accepted |
| [ADR-005](ADR-005-data-layer-rtk-query.md) | Data layer via RTK Query (supersedes PRD thunks) | Accepted |
| [ADR-006](ADR-006-storage-securestore-asyncstorage-mmkv-northstar.md) | Storage: secure-store + AsyncStorage now, MMKV north star | Accepted |
| [ADR-007](ADR-007-persistence-and-offline-strategy.md) | Persistence & offline: cache-persist now, local-first sync north star | Accepted |
