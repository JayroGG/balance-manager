# ADR-009 — Amount-based vault allocation (follows backend ADR-004)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** mobile + backend agents
- **Supersedes / Related:** backend ADR-004 (`vault-allocation-model`); refines PRD §4.1, §8; relates to ADR-005

## Context

The original model funded vaults by **tagging a transaction** to a vault: a transaction carried a
`vault_id`, allocate/withdraw took a `transaction_id`, and a vault's balance was the sum of its
tagged income. This conflated the **ledger** (money in / out) with **savings allocation** and left a
gap: nothing stopped you spending money that was supposedly locked in a vault.

The backend corrected this in its **ADR-004**. The change is breaking for the client:

- Transactions lost `vault_id` — they are now a **pure ledger**.
- `/vaults/:id/allocate|withdraw` now take **`{ amount }`** (decimal), not `{ transaction_id }`.
- Vault history rows lost `transaction_id` (`{ id, user_id, vault_id, action, amount, created_at }`).
- New invariant: **`available` can never go negative** — writes that would overspend locked money
  (oversized expense, editing an expense up / income down, deleting an income whose money is vaulted,
  allocating more than `available`, withdrawing more than the vault holds) return `400`.
- A vault can only be **deleted at a zero balance**.

`GET /balance`'s shape is unchanged (`{ total, available, vaults:[{id,name,balance,target}], currency }`);
only its semantics are tighter (`available ≥ 0`).

## Decision

Mirror the backend model on the client:

- **Now (prototype):**
  - Remove the **vault picker** from the transaction create/edit form; drop `vault_id` from the
    transactions data layer (filters, body, record shape) and from the RTK Query `Vault`
    invalidation on transaction mutations (they only move `Balance` now).
  - Vault detail's **allocate/withdraw** become a plain **amount input**, capped client-side at
    `available` (allocate) / the vault balance (withdraw) to fail fast — the backend remains the
    authority and its `400` `error` is surfaced as-is.
  - Vault **delete** is disabled in the UI unless the vault balance is zero.
  - After allocate/withdraw, invalidate `Balance` (+ `Vault`, `VaultHistory`) so the dashboard and
    vault cards refetch and stay consistent.
- **North star (unchanged):** local-first offline writes + sync (ADR-007) layer cleanly on top — the
  amount-based actions are simpler to queue in an outbox than transaction-tagging was.
- **Boundary:** the swap stayed inside the data layer (`services/api/{transactions,vaults}.js`) and
  the two affected screens; the auth/storage seams and `/balance` consumers were untouched.

## Consequences

- **Positive:** transactions and savings are cleanly separated; the "spend locked money" gap is
  closed; allocate/withdraw UX is a single amount field (no transaction-eligibility logic to load).
- **Negative / trade-offs:** client-side caps duplicate a backend rule (kept intentionally minimal —
  a disabled button + the backend `400`, no elaborate pre-flight).
- **Follow-ups:** when real auth lands (ADR-001) the same `400` surfacing path covers per-user limits.

## Alternatives considered

- **Keep transaction-tagging on the client, adapt only labels** — rejected: the backend dropped
  `vault_id` and `transaction_id` entirely, so the old UX has no contract to call.
- **Free-form amount with no client cap** — rejected: a cheap disabled-button check gives instant
  feedback without a round-trip; the backend `400` still backs it.
