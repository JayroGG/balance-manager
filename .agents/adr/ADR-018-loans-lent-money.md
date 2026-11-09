# ADR-018 — Loans: lent-out money as a first-class entity (vault-mirror balance math)

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Jayro (product/eng)
- **Supersedes / Related:** ADR-009 (amount-based vault movements — the model this mirrors),
  ADR-015 (server-side transaction creation precedent), ADR-011/ADR-012 (context scoping + RBAC)

## Context

Real use hit a wall (same origin as shopping lists): money lent to people can't be expressed.
Jayro lent 10K (9K repaid, 1K pending) and 23K (fully pending). The workaround — register the full
loan as income and park the *repaid* cash in a vault — inverts the semantics: `available` ends up
showing the **pending** amount, and the vault locks money that is actually spendable. The app needs
a way to say "this wealth is mine but it's out on loan": counted in `total`, excluded from
`available`, released as repayments arrive.

## Decision

- **Direction: lent-out only (receivables).** A loan is money owed *to* the user. Tracking debts
  the user owes (a `direction` field) is a **north star**, not in this phase.
- **Balance math mirrors vaults.** Lending converts cash→claim and repayment claim→cash, so **no
  movement ever changes `total`**:
  - `pending = Σ lend − Σ repay` (derived from movements, like a vault balance);
    `amount = Σ lend` (total ever lent, the progress denominator); `repaid = amount − pending`.
  - `available = total − Σ vault balances − Σ loan pending` — the only formula change.
  - **Lend** (bounded by `available`) moves spendable → pending; **repay** (bounded by `pending`)
    moves pending → spendable. Both are `POST /loans/:id/{lend,repay}` with `{ amount }`, recorded
    in a loan history exactly like vault allocate/withdraw.
- **Journal rows keep the ledger complete without double counting.** Every lend/repay *also*
  writes a transaction carrying **`loan_id`** (`expense` for lend, `income` for repay, description
  from the loan name). Rows with `loan_id` are **excluded from the balance computation and from the
  client's history totals** — they are display-only "whole story" records, server-owned
  (read-only via `/transactions`). The existing income/expense stats never see a loan movement.
- **Pre-existing loans open atomically.** `POST /loans { name, amount, pre_existing: true }` posts
  a **counted** plain income ("Loan opening: <name>", `loan_id = NULL`) *and* the initial lend
  movement in one action: `total +amount`, `available ±0`. Without the flag, creation takes the
  amount out of `available` (bounded, like vault allocate).
- **Delete requires `pending == 0`** (mirror of the vault zero-balance rule). Journal rows survive
  deletion as frozen history (shopping-lists precedent).
- **Navigation: Loans replaces the Categories tab.** Categories management moves under Settings
  (settings becomes a stack) — the tab bar stays at six items and the rarely-used screen steps back.
- Standard everything else: `?team_id=` context scoping (param only), owner/member/guest RBAC via
  `usePermissions`, theming via `useTheme`, events in the `/events` activity feed.

## Consequences

- **Positive:** the dashboard finally tells the truth — `total` includes lent wealth, a "Lent out"
  line shows Σ pending, and `available` only ever contains spendable cash; repayments free money
  visibly. The equilibrium is self-guarding: the existing "`available` can never go negative" rule
  already protects every path (including deleting an opening income whose money is still lent).
  Nothing is thrown away later: a `direction` column extends the same entity to borrowed money.
- **Negative / trade-offs:** `GET /transactions` rows gain `loan_id` and the transactions screen
  must treat journal rows specially (badge + exclusion from totals) — a small permanent tax on the
  "pure ledger" idea, accepted for the visibility it buys. Two rows appear for a pre-existing
  opening (counted income + excluded journal expense). Categories loses its tab slot.
- **Follow-ups / north stars:** write-off ("forgive" a loan: a *counted* expense + pending reset —
  without it a dead loan can never be deleted, only kept at its pending amount); borrowed-direction
  loans; occasional-partial-lend UX niceties (e.g. lend straight from the transaction form).

## Alternatives considered

- **Counted real transactions for movements** — rejected: a repayment would inflate income stats
  and double-move `available` (the pending discount *and* the income), the exact confusion the
  feature exists to kill.
- **Loan-internal movements only (pure vault clone, no journal rows)** — rejected by product
  choice: the transactions history should tell the whole story; since the month totals are computed
  client-side, excluding flagged rows is cheap.
- **Modeling loans as vaults with a convention** — the status quo workaround; inverts `available`
  semantics and was the trigger for this ADR.
