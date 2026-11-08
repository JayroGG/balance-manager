# ADR-020 — Migration from Claude Code to OpenCode

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** **Supersedes ADR-002** (documentation & agent-workflow standard). The
  docs set, workflow loop, and append-only ADR rules it established carry over unchanged — only the
  tooling, paths, and model-selection scheme change here.

## Context

ADR-002 standardized this repo's agent workflow around Claude Code: `CLAUDE.md` as the entry doc,
agent memory under `.claude/` (`.claude/ADR/`, `.claude/agents/plans/`), and model choices hardcoded
as specific Claude model names in prose and rules. That carried three costs:

- **Vendor lock-in.** Concrete model names in rules and docs meant every model change was a
  cross-project prose edit, and only one vendor's models were eligible.
- **Tool-bound memory.** `CLAUDE.md` + `.claude/` are Claude Code's layout; other agents re-derive
  context instead of reusing it.
- **Duplicated engine.** Agents, commands, and workflow rules were re-declared per project although
  identical across repos.

OpenCode provides the same swarm workflow (orchestrator + workers + reviewer) with provider-agnostic
model selection and a shared global config — a chance to fix all three at once.

## Decision

**This is a full swap, not a "shoot high, ship lean" bypass — there is no north-star gap to record.**
Claude Code is replaced outright by OpenCode:

1. **Entry doc:** `AGENTS.md` is the single source of truth at the project root — a short index
   pointing into `.agents/`; `CLAUDE.md` is reduced to just `@AGENTS.md`.
2. **Docs relocated:** ADRs `.claude/ADR/` → `.agents/adr/`; plan docs `.claude/agents/plans/` →
   `.agents/plans/` — history preserved via `git mv`.
3. **Config:** new project `opencode.jsonc` (permission allowlist translated from
   `.claude/settings.local.json`); `default_agent: "orchestrator"` is set in the global config,
   `~/.config/opencode/opencode.jsonc`.
4. **Model selection by tier:** Tier 1 (orchestrator/reasoner), Tier 2 (implementation + review),
   Tier 3 (cheap/fast exploration and mechanical edits) — provider-agnostic, replacing the hardcoded
   Claude model names. Concrete model IDs live only in the tier table and agent `model` frontmatter —
   never in prose or rules.
5. **Swarm preserved:** Tier 1 orchestrator as the primary session; Tier 2 workers as subagents, one
   well-specified task each; Tier 2 reviewer, read-only.
6. **Commands:** `/prime`, `/plan-feature`, `/implement` (renamed from `/execute`), `/review`,
   `/write-adr`, `/commit`, `/create-prd`, `/create-rules`, `/session-log`.
7. **Global vs project split:** `~/.config/opencode/` holds the reusable engine (agents, commands,
   skills, tier pools, workflow/swarm docs); the project keeps `AGENTS.md`, `opencode.jsonc`, and its
   own `.agents/` docs.

## Consequences

- **Positive:** model changes are a single edit in the tier table + agent frontmatter, not prose
  edits across every project — and any vendor's models can fill a tier.
- **Positive:** the workflow engine is written once, globally — bootstrapping a new project needs
  only `AGENTS.md` + `opencode.jsonc` + its own `.agents/` docs.
- **Positive:** ADR and plan history survive the move (`git mv` preserves it; the append-only rule is
  what makes this a supersede rather than a rewrite).
- **Negative / trade-offs:** the global engine becomes a single point of drift — changes there hit
  every project at once, so it needs its own version control.
- **Negative / trade-offs:** tier indirection adds a lookup step ("which model is in Tier 2 today?")
  where rules used to name one.
- **Follow-ups:** ADR-002's status flips to `Superseded by ADR-020` (its docs set and workflow
  standard live on through this ADR); keep `~/.config/opencode/` under its own version control;
  per-project tier-pool overrides are possible via `.agents/model-tiers.md` when a project needs
  different pool defaults.

## Alternatives considered

- **Stay on Claude Code.** Rejected: keeps the vendor lock-in, hardcoded model names, and
  per-project duplication of the workflow engine.
- **Keep `.claude/` paths (new content, old layout).** Rejected: a half-migrated state — two naming
  schemes, memory split across directories, and config the new tool doesn't read.
- **Keep hardcoded model names instead of tiers.** Rejected: every model change edits prose across
  all projects and the pool stays locked to one vendor — exactly the lock-in this migration removes.
