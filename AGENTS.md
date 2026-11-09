# AGENTS.md — `balance-mobile`

Short index. Read the detailed docs in `.agents/` **on demand** — do not pre-load everything. When a doc is referenced here, read it when you're doing that kind of work.

## Mental model

Expo React Native **thin client** for the `balance` backend (single-user personal-finance REST API: transactions, categories, savings vaults, loans, computed balance). The backend owns all business logic and the cents↔decimal boundary; the app consumes decimals and renders them with the currency label `/balance` returns. Details: `ARCHITECTURE.md` (Mermaid diagrams + file map), `PRD.md`, and `.agents/project-context.md`.

## Workflow (short)

1. `/prime` — load context (docs + git log + structure).
2. `/plan-feature <task>` — research only → plan in `.agents/plans/`.
3. `/implement <plan>` — orchestrate: Tier 1 orchestrator dispatches Tier 2 workers, then review.
4. `/review` — read-only Tier 2 review.
5. `/commit` — conventional commit.
6. `/write-adr` — record the decision in `.agents/adr/`.

**Docs, ADR, and plan updates are part of "done"** — a feature is not finished until its docs are in sync.

## Model tiers

Select models by **tier only**, never by vendor/model name. Definitions + pools are **global** — `~/.config/opencode/AGENTS.md` § Model tiers. The orchestrator asks which pool model to use per task.

## Read X when doing Y

- Starting any work → `ARCHITECTURE.md`, `PRD.md`, and the global Model tiers (`~/.config/opencode/AGENTS.md`).
- Planning a feature → `~/.config/opencode/docs/workflow.md` + run `/plan-feature`.
- Implementing → `~/.config/opencode/docs/swarm.md` (orchestrator/worker/reviewer) + `.agents/project-context.md` (key files + conventions).
- Reviewing → `/review` (read-only).
- Finishing a feature → `.agents/branch-and-pr.md` (branch flow + PR format).
- Making a decision → `.agents/adr/ADR-000-template.md` + `.agents/adr/README.md` index.

## Conventions (brief)

- Minimal changes only; validate at boundaries; trust internal guarantees.
- Money is decimal end-to-end (never cents); `formatMoney` densities via `showCurrency`.
- Team context via `?team_id=` query param only (`withTeam`); RBAC via `usePermissions`; theming via `useTheme` (never a static color import).
- Tap targets: the whole control is the target (padding or `hitSlop`).

Full detail: `.agents/project-context.md`.
