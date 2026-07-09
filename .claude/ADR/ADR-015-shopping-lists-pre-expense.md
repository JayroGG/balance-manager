# ADR-015 — Shopping lists: pre-expense checklists with a server-side checkout

- **Status:** Accepted
- **Date:** 2026-07-06
- **Deciders:** Jayro (product/eng)
- **Supersedes / Related:** ADR-009 (amount-based money actions), ADR-011 (team context), ADR-012 (RBAC)

## Context

Every movement reaches the ledger by manual entry after the fact. A very common flow — groceries —
is *planned*: the user knows roughly what they'll buy, walks the store ticking items off, and pays
one total at the till. Today that planning happens in a separate notes/todo app and the total is
retyped into `balance` as a transaction, losing the link between "what I planned" and "what I spent".

We want a checklist that lives **before** the ledger and closes the loop with one action at
checkout. Constraints: POC scope, Expo Go only (no new native modules), the money boundary and the
`available`-can't-go-negative invariant live server-side (ADR-009), and everything is context-scoped
personal/team via `?team_id=` (ADR-011) under the RBAC matrix (ADR-012).

## Decision

A new backend entity pair — `shopping_lists` + `shopping_list_items` — plus one custom action,
`POST /shopping-lists/:id/checkout`, that posts the expense transaction **server-side**. Contract:
`docs/backend-shopping-lists-request.md`. Resolved design points:

- **Now (MVP):**
  - **Item status = a checkbox** (`checked` boolean). The in-store gesture is binary (got it / not
    yet); a status enum is overkill.
  - **Optional per-unit `price`** on items (a running in-store estimate) **plus a required, editable
    `amount` at checkout**, prefilled with the sum of *checked* items' `qty × price`. Real tickets
    never match estimates, so the client always sends the final number; the server never guesses it.
  - **One-shot lifecycle:** `status: 'open' → 'purchased'`. Checkout creates one `expense`
    transaction whose `description` is the list name, links it (`transaction_id`), and freezes the
    list. Purchased lists are read-only history; deleting a list (soft) never touches its transaction.
  - **Context-scoped like transactions/vaults:** `team_id` column + `?team_id=` query param, never a
    body field. Checkout posts into the **list's own context**, and the standard RBAC matrix gates
    every write (guest read-only; member own-lists; owner all; personal = full).
  - **Server-side checkout** so the atomic (post + link + status flip) and the `available` rule have
    exactly one owner — the same reasoning that keeps vault allocate/withdraw on the server (ADR-009).
  - **Mobile surface:** a stack *inside the transactions tab* (`app/(tabs)/transactions/lists/`),
    entered via a cart action in the Transactions header — lists are "pre-expenses", and the tab bar
    is already full (6 tabs). One RTK Query file `shoppingLists.js` (tag `ShoppingList`); checkout
    invalidates `Transaction` + `Balance` so the ledger and dashboard refresh.
- **North star (deferred):** reusable list templates / "duplicate last week's list"; an item status
  enum (`pending | in_cart | unavailable`); per-item→category mapping and per-item spend analytics;
  a server-side `GET /transactions?from=&to=` date filter (see the history-filter decision below).
- **Boundary:** the checkout endpoint is the seam — the client hands it a final `amount` and a
  context; all ledger rules stay behind it, so richer item models never leak money logic to the app.

### History month/year filter (shipped alongside)

The Transactions history gains a month + year filter ("All" or a specific month of a specific year),
composing with the existing type chips. It runs **client-side** — a prefix match on `occurred_at`
(`YYYY-MM-DD`) over the already-fetched list, since there is no pagination yet. A backend
`?from=&to=` range is requested as an optional, non-blocking slice for pagination day.

## Consequences

- **Positive:** the plan→spend loop closes with zero retyping; the expense lands in the right
  context with the list's name; the app stays in Expo Go (no native modules); ledger invariants keep
  a single owner. The month filter ships immediately with no backend dependency.
- **Negative / trade-offs:** Part 1 can't be exercised end-to-end until the backend implements the
  request doc (client code + tests land first against mocks). Client-side history filtering assumes
  the full list is fetched — fine at POC scale, revisited when pagination arrives. In-store toggles
  aren't offline-durable (an optimistic cache patch covers the feel; ADR-007's local-first phase is
  the real fix).
- **Follow-ups:** plan `.claude/agents/plans/005-shopping-lists-and-month-filter.md`; backend
  request `docs/backend-shopping-lists-request.md`.

## Alternatives considered

- **Client-side checkout (POST the transaction from the app, then PATCH the list)** — rejected:
  splits the atomic action and duplicates the `available` rule the backend already owns.
- **A dropdown item-status enum instead of a checkbox** — rejected for MVP: the store gesture is
  binary; recorded as a north star.
- **Sum items server-side to compute the checkout amount** — rejected: real receipts diverge from
  estimates (taxes, unlisted items, price changes); the user must confirm the real total.
- **A top-level "Lists" tab** — rejected: the tab bar already holds six; lists are pre-expenses and
  belong with the ledger.
- **Server-side month filter now** — deferred: no pagination exists, so a prefix match over the
  fetched list is exact and free; the range param is a north star, not a blocker.
