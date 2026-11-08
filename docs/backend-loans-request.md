# Request to `balance` backend — loans (lent-out money) + balance discount

> **From:** `balance-mobile` (repo `/Users/jayro/Dev/ReactNative/Projects/balance-manager`)
> **To:** the `balance` backend agent (repo `/Users/jayro/Dev/Node/Projects/balance`)
> **Date:** 2026-07-15
> **Why:** the mobile side is adding **loans** — money the user *lent to someone* (receivables).
> Real case: 10K lent to a friend (9K repaid, 1K pending) and a separate 23K fully pending. The
> user wants their `total` to include wealth that is out on loan, while `available` only ever
> contains spendable cash; repayments release money back to `available`. Today this is faked with
> income + vaults and the semantics come out inverted.
>
> Client design record: `balance-mobile` ADR-018
> (`.claude/ADR/ADR-018-loans-lent-money.md`). This doc is the actionable contract.

## Concepts (30 seconds)

- **A loan is a receivable, not a bank product.** `name` (usually the person), an amount lent, and
  a **pending** amount still owed to the user. Context-scoped exactly like `vaults`
  (`team_id` column, `?team_id=` query param, never a body field).
- **Movements mirror vault allocate/withdraw** (backend ADR-004 / mobile ADR-009): **lend** moves
  spendable → pending (bounded by `available`), **repay** moves pending → spendable (bounded by
  the loan's `pending`). `pending` is **derived from the movement history**, like a vault balance.
  Neither movement changes `total` — cash converts to a claim and back.
- **Journal rows:** every lend/repay *also* creates a transaction carrying a new nullable
  **`transactions.loan_id`** — `expense` for lend, `income` for repay, `description` from the loan
  name. Rows with `loan_id` are **excluded from the `/balance` computation** — they are
  display-only history ("the ledger tells the whole story") and **server-owned** (see invariants).
- **Pre-existing loans** (lent before the app tracked it — the 23K case): creation with
  `pre_existing: true` atomically posts a **counted** plain income (`loan_id = NULL`,
  description "Loan opening: <name>") *plus* the initial lend movement. Net effect:
  `total +amount`, `available ±0`, in one action — same atomicity philosophy as the shopping-list
  checkout (one owner for ledger invariants).

### The equilibrium (why this can't double count)

Let `base = Σ income − Σ expense` over transactions **where `loan_id IS NULL`** (openings count,
journal rows don't). Per loan: `pending = Σ lend − Σ repay`, `amount = Σ lend`.

- `total = base` (formula unchanged, it just skips `loan_id` rows)
- `available = total − Σ vault balances − Σ loan pending`  ← the only formula change
- Lend x → `pending +x`: available −x, total ±0. Repay x → `pending −x`: available +x, total ±0.
- Pre-existing open A → counted income +A and `pending +A`: total +A, available ±0.
- The existing **`available` can never go negative** rule needs no new machinery: it must simply
  evaluate against the new `available` (so e.g. deleting an opening income while its money is
  still lent is rejected, exactly like deleting income locked in a vault).

## Requested contract

### 1. Data

House `schema.sql` style; money as **cents** via `moneyFields`; soft-delete like the rest:

```sql
CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id),   -- NULL = personal (standard context scoping)
  name TEXT NOT NULL,
  created_at TEXT ..., updated_at TEXT ..., deleted_at TEXT
  -- no money columns: amount/pending derive from loan_history, like a vault balance
);

CREATE TABLE loan_history (               -- mirror of the vault history table
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  loan_id INTEGER NOT NULL REFERENCES loans(id),
  action TEXT NOT NULL,                   -- 'lend' | 'repay'
  amount INTEGER NOT NULL,                -- cents (moneyFields)
  created_at TEXT ...
);

ALTER TABLE transactions ADD COLUMN loan_id INTEGER REFERENCES loans(id);  -- the journal flag
```

### 2. Entities & endpoints (house pattern: `src/entities/<name>/`)

`loans` is context-scoped like the financial entities — same `?team_id=` handling as `/vaults`
(param only, server injects on writes; personal when absent). Custom routes registered **before**
restGenerator, as usual:

| Endpoint | Notes |
|---|---|
| CRUD `/loans` | restGenerator. Create body `{ name, amount?, pre_existing? }` — see creation semantics below. Update: `{ name }` only (money moves only through lend/repay). |
| `GET /loans/:id/history` | `200` array of `{ id, user_id, loan_id, action, amount, created_at }`, newest first — mirror of the vault history route. |
| `POST /loans/:id/lend` | Body `{ amount }` (decimal, positive). Bounded by **`available`** → else `400`. Atomically: history `lend` row + journal `expense` transaction (`loan_id`, `description = loan.name`) in the loan's context. Returns `200` with the updated loan figures `{ id, name, amount, pending }`. |
| `POST /loans/:id/repay` | Body `{ amount }` (decimal, positive). Bounded by the loan's **`pending`** → else `400`. Atomically: history `repay` row + journal `income` transaction (`loan_id`, `description = loan.name`). Returns `200` with `{ id, name, amount, pending }`. |

**Creation semantics** (`POST /loans`):
- `{ name }` alone → empty loan (pending 0), like creating a vault.
- `{ name, amount }` → create + initial **lend** atomically (bounded by `available`, `400` if over).
- `{ name, amount, pre_existing: true }` → create + counted plain income
  (`loan_id = NULL`, description `"Loan opening: <name>"`, in the loan's context) + initial lend
  movement + its journal row, all atomic. Net: `total +amount`, `available ±0`. Nothing is written
  if any step fails.

### 3. `GET /balance` changes

```json
{
  "total": 33000.00,
  "available": 9000.00,
  "lent": 24000.00,
  "vaults": [ ... unchanged ... ],
  "loans": [
    { "id": 1, "name": "Juan", "amount": 10000.00, "pending": 1000.00 },
    { "id": 2, "name": "Brother", "amount": 23000.00, "pending": 23000.00 }
  ],
  "currency": "USD"
}
```

- `total` — same formula, computed over `loan_id IS NULL` transactions only.
- `available = total − Σ vault balances − Σ loan pending`.
- `lent = Σ pending` (the dashboard breakdown line).
- `loans[]` — per-loan figures (`amount` = Σ lend, `pending`); like vaults, the list screen reads
  its figures from `/balance`, `GET /loans` returns the records only.

### 4. `GET /transactions` changes

- Rows gain `loan_id` (nullable) — **shape change note** for any other consumer.
- No new filters required: the client filters journal rows client-side (the list is fully fetched).

### 5. Invariants (enforce in hooks per house convention; violations → `{ error }` + status)

- `amount` > 0 on lend/repay/create-with-amount → else `400`.
- **Lend ≤ `available`** (spendable money only — vault-locked and already-lent money can't be
  lent) → else `400`. **Repay ≤ `pending`** → else `400`.
- **Loan delete requires `pending == 0`** → else `400` (mirror of the vault zero-balance rule).
  Journal rows are **not** touched by loan deletion — frozen history, like shopping-list
  transactions surviving list deletion.
- **`loan_id` is server-owned:** reject (or ignore) it in `POST/PUT /transactions` bodies, and
  make loan-linked transactions **read-only** through `/transactions` (`400` on PUT/DELETE) —
  they are journal entries whose truth lives in `loan_history`. (If the house prefers them
  mutable like shopping-list checkouts, say so and mobile will adapt — but read-only is the
  recommendation since, unlike a checkout, these rows have a derived source of truth.)
- The **`available`-never-negative** rule evaluates against the new `available` everywhere it
  already fires (expense create/edit, income delete/edit-down, vault allocate) — no new rule, new
  input.
- `loan_history.action` ∈ `lend | repay` → else `400`.

### 6. RBAC + context (backend teams ADR / mobile ADR-012)

Standard matrix, same as vaults: guest read-only; member creates loans and lends/repays/edits/
deletes **own** loans (`user_id` match); owner all; personal context full access. `403` on
violation. `team_id` in the query string only, never a body field.

### 7. Events (activity feed, backend events ledger / mobile ADR-017)

Emit into `/events` like the other entities:

| Event | `summary` |
|---|---|
| `loan` / `created` | `{ name }` (include `amount` when created with one) |
| `loan` / `updated` | `{ name }` |
| `loan` / `deleted` | `{ name }` |
| `loan` / `lent` | `{ name, amount }` |
| `loan` / `repaid` | `{ name, amount }` |

### 8. What mobile consumes (examples)

```http
POST /loans?team_id=4            { "name": "Brother", "amount": 23000, "pre_existing": true } → 201
     → income "Loan opening: Brother" +23,000 (counted, loan_id NULL)
     → loan_history lend 23,000 · journal expense "Brother" (loan_id set, excluded)
     → total +23,000 · available ±0

POST /loans                      { "name": "Ana", "amount": 200 }        → 201
     → available −200 (bounded; no opening income)

POST /loans/1/repay              { "amount": 500 }                       → 200 { id, name, amount, pending }
     → journal income "Juan" +500 (excluded) · pending −500 · available +500

POST /loans/1/repay              { "amount": 99999 }                     → 400 (over pending)
POST /loans/2/lend               { "amount": 50000 }                     → 400 (over available)
DELETE /loans/2                  (pending > 0)                           → 400
GET  /balance?team_id=4          → { total, available, lent, vaults[], loans[], currency }
```

## Open questions / follow-ups (not blocking)

- **Write-off ("forgive")**: a loan the debtor never repays currently can never be deleted — its
  pending stays forever. The honest fix is a `POST /loans/:id/write-off` that posts a **counted**
  expense for the remaining pending and zeroes it (wealth genuinely lost). Deferred; flag if you'd
  rather ship it in the same pass.
- **Borrowed direction** (money the user owes): north star — a `direction` column on `loans`
  extending the same entity; nothing in this contract should preclude it.
- Journal-row mutability: see §5 — read-only is requested, push back if that fights the house
  pattern.
