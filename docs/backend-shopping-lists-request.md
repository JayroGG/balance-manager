# Request to `balance` backend — shopping lists (pre-expense checklists) + checkout

> **From:** `balance-mobile` (repo `/Users/jayro/Dev/ReactNative/Projects/balance-manager`)
> **To:** the `balance` backend agent (repo `/Users/jayro/Dev/Node/Projects/balance`)
> **Date:** 2026-07-06
> **Why:** the mobile side is adding a supermarket-style checklist that lives *before* the ledger:
> the user creates a named list ("Supermarket"), adds items, checks them off while shopping, and at
> the till **checks out** — one action that records a real `expense` transaction titled with the
> list name and freezes the list as purchased history. The transaction must be created
> **server-side** in the checkout endpoint (atomic: post + link + status flip) so the ledger
> invariants (`available` can never go negative) have exactly one owner — same philosophy as the
> in-flight transfers/captures work.
>
> Client design record: `balance-mobile` ADR-015 (`.claude/ADR/ADR-015-shopping-lists-pre-expense.md`)
> and plan `.claude/agents/plans/005-shopping-lists-and-month-filter.md`. This doc is the actionable
> contract. Suggested delivery: **Slice 1** (lists + items + checkout) is what the client needs;
> **Slice 2** (transactions date filter) is an optional nice-to-have.

## Concepts (30 seconds)

- **`shopping_lists`** — a named pre-expense: a checklist that will *become* one transaction. It is
  **context-scoped exactly like `transactions`/`vaults`** (`team_id` column, `?team_id=` query
  param, never a body field): a household team shares its supermarket list, and checkout posts into
  the **list's own context**, not whatever context the caller has active.
- **`shopping_list_items`** — the checklist rows: a name, an optional per-unit `price` (estimate —
  gives the user a running total in-store), an optional `qty`, and a `checked` flag (binary
  checkbox; got it / not yet).
- **Checkout** — the one custom action: for an `open` list, create an `expense` transaction with
  `description = list.name` in the list's context, link it (`transaction_id`), and flip
  `status → 'purchased'`. The client always sends the final `amount` (real tickets never match
  estimates); the server never sums items to guess it.
- Purchased lists are **frozen history**: no more item writes or list edits; they keep pointing at
  their transaction. Deleting a list (open or purchased) never touches the ledger.

## Slice 1 — requested contract

### 1. Data

New tables (house `schema.sql` style; money as **cents** via `moneyFields`; soft-delete like the
rest):

```sql
CREATE TABLE shopping_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id),          -- NULL = personal (standard context scoping)
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',           -- 'open' | 'purchased'
  category_id INTEGER REFERENCES categories(id), -- default category for checkout (nullable)
  transaction_id INTEGER REFERENCES transactions(id),  -- set by checkout, else NULL
  created_at TEXT ..., updated_at TEXT ..., deleted_at TEXT
);

CREATE TABLE shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  list_id INTEGER NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  price INTEGER,                                 -- cents (moneyFields); optional per-UNIT estimate
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT ..., updated_at TEXT ..., deleted_at TEXT
);
```

No `transactions` schema change is required by this feature.

### 2. Entities & endpoints (house pattern: `src/entities/<name>/`)

`shopping_lists` is context-scoped like the financial entities — same `?team_id=` handling as
`/transactions` (param only, server injects on writes; personal when absent):

| Endpoint | Notes |
|---|---|
| CRUD `/shopping-lists` | restGenerator; `filterFields` at least `status` (the client lists `?status=open` and `?status=purchased` separately). Rows carry `team_id` like transactions do. Soft-deleting a list soft-deletes its items. |
| CRUD `/shopping-list-items` | restGenerator, flat (like the planned `/source-aliases`); list via `?list_id=` (`filterFields`). Context/ownership is checked through the parent list. Body: `{ list_id, name, qty?, price?, checked? }`; `price` is decimal at the API boundary as usual. |
| `POST /shopping-lists/:id/checkout` | **The one custom action** — custom route registered **before** restGenerator. Body: `{ amount, category_id?, occurred_at? }` (decimal, positive). Atomically: create an `expense` transaction in the **list's** context with `description = list.name` (`category_id` falls back to the list's own, `occurred_at` to today), set `transaction_id`, flip `status → 'purchased'`. Returns `200` with the updated list (including `transaction_id`). |

### 3. Invariants (enforce in hooks per house convention; violations → `{ error }` + status)

- `shopping_lists.status` ∈ `open | purchased` → else `400`.
- **Checkout only for `open` lists** → a second checkout (or checkout of a purchased list) `400`s.
- Checkout requires **at least one checked item** → else `400` (an empty checkout is a plain manual
  transaction — the form already exists for that).
- **Item writes and list edits only while the list is `open`** → else `400`. Purchased lists are
  frozen history (rename/category/status edits all rejected; delete is still allowed).
- Checkout `amount` must be `> 0` → else `400`. The posted transaction goes through the normal
  transactions pipeline, so the ledger's **`available`-can't-go-negative** rule applies — a
  violating checkout `400`s with that error and **nothing is written** (no transaction, no status
  flip).
- `shopping_list_items.qty` > 0; `price`, when present, ≥ 0 → else `400`.
- Deleting a list — open or purchased — **never touches its transaction**; the transaction remains
  deletable/editable on its own through `/transactions` as usual.
- `transaction_id` and `status` are **server-owned**: reject them in create/update bodies (or
  ignore, per house preference — mobile never sends them).
- **RBAC (backend ADR for teams / mobile ADR-012):** standard matrix — guest read-only; member may
  create lists and edit/checkout/delete **own** lists (`user_id` match); owner all; personal context
  full access. `403` on violation.

### 4. What mobile consumes (examples)

```http
GET /shopping-lists?status=open&team_id=4          → 200 [ { id, user_id, team_id, name, status,
                                                       category_id, transaction_id, ... } ]
POST /shopping-lists?team_id=4                     { "name": "Supermarket" }              → 201
POST /shopping-list-items?team_id=4                { "list_id": 7, "name": "Milk",
                                                     "qty": 2, "price": 25.50 }           → 201
PUT  /shopping-list-items/31?team_id=4             { "checked": true }                    → 200
POST /shopping-lists/7/checkout?team_id=4          { "amount": 418.70, "category_id": 3 } → 200
     → creates expense "Supermarket" ($418.70) in team 4's ledger, returns the list with
       transaction_id set and status "purchased"
POST /shopping-lists/7/checkout?team_id=4          (again)                                → 400
```

Client behavior for reference: the checkout form prefills `amount` with Σ(`qty × price`) of the
**checked** items (skipping unpriced ones) but the user edits it to the real ticket total before
confirming. `team_id` stays a query param — the checkout body carries **no** team fields.

## Slice 2 — optional nice-to-have (not blocking)

A date-range filter on the transactions list, for when the ledger grows past "fetch everything":

| Endpoint | Notes |
|---|---|
| `GET /transactions?from=YYYY-MM-DD&to=YYYY-MM-DD` | Inclusive range on `occurred_at`. Either bound optional. |

The mobile month/year history filter ships **client-side** (prefix match on `occurred_at` over the
already-fetched list), so this slice is purely a north star for pagination day. Skip it if it
doesn't fit the current pass.
