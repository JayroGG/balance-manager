# ADR-023 — Credit cards UI

- **Status:** Accepted (FE `balance-manager`)
- **Date:** 2026-11-26

## Context
BE ADR-014 adds cards, card charges and card payments. Card spends are tracked but must not touch cash
until the card is paid from the balance.

## Decision
- Cards screens live under the Settings stack (`settings/cards`): list, new/edit, detail (owed,
  "Pay <statement_balance> by <due_date>", current period, charges + payments history). Entry points: a
  Settings row and the Dashboard cards block (cross-tab deep link, ADR-004/008 guards).
- Pay flow: amount prefilled with the statement balance, editable (partial / full owed / any <= owed);
  an overdue statement (`due_date` past with `statement_balance > 0`) is flagged, never rolled forward.
- Transaction form "Paid with": Cash (default) or a card, expenses only; edit can move a charge back to cash
  (`card_id: null`).
- Transactions list: card badge on charges, payments (`card_payment`) shown as a neutral transfer (not a red
  expense); filter by card. Client totals read the server `totals` (they gain `card_payments`).
- Dashboard cards block (total owed + next due card/amount) when at least one card exists, under ADR-019's
  trust rules (no money under an unconfirmed context). Next due = card with `statement_balance > 0` and the
  earliest `due_date`, from `/balance` `cards[]`.

## Consequences
- New `Card` cache tag, invalidated by card edits/payments and by every transaction write (charges change
  `owed`).
- `total`/`available` stay cash-only; `cards_owed` is shown separately and never subtracted client-side.

## Alternatives considered
- A dedicated Cards tab: rejected — the tab bar is full; Settings + Dashboard shortcut keep it reachable.
