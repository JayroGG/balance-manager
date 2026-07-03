# ADR-014 — Auto-capture domain model: sources, aliases, captures, transfers

- **Status:** Accepted (2026-07-03)
- **Relates to:** ADR-011 (team context), ADR-012 (RBAC), ADR-003 (Expo Go constraint)
- **Design session:** `docs/auto-transaction-capture-research.md` §8 · **Backend contract:**
  `docs/backend-auto-capture-request.md` → work-done `balance/docs/react-native-auto-capture-update.md`

## Context

Every movement reaches `balance` by manual entry. Payment notifications (Google Wallet / Apple Pay /
bank pushes) can automate that, but raw notifications are ambiguous — the same purchase is reported
by two apps, card-less pushes (SPEI) name no card — and context-blind: an automation can't know
which tab is open. Neither wallet exposes a transaction-read API (§2 of the research doc), so every
path is indirect evidence capture.

## Decision

1. **A notification is evidence, not a transaction.** New backend layer between "notification
   arrived" and "transaction exists": `captures` (ingest ledger with status
   `pending|posted|duplicate|discarded`).
2. **`payment_sources` are pots of money** (bank `account` or `credit_card`) owned by the user —
   never team-scoped. A **debit card is an alias of its account**, not its own source.
3. **Recognition via `source_aliases`**: `(channel, card_last4)` or `(channel, channel_default)` for
   card-less pushes; one default per channel (else the review inbox). An unregistered last4 falls
   back to the channel default (single-pot channels are unambiguous).
4. **Routing is per-source** (`target_team_id`, `NULL` = personal), never the app's active context.
   A source may only target a team the user can write to.
5. **Resolution runs server-side** on one dumb ingest endpoint (`POST /captures`): exact
   `notification_hash` dedup (idempotent 200) → alias match → ±5 min cross-channel dedup →
   **auto-post** (default; the review inbox is the exception path). A well-formed capture never gets
   a 4xx outcome — failures (available rule, unwritable team) leave it `pending`. Devices send
   structured fields only; raw notification text never leaves the phone.
6. **Automation tokens**: long-lived (365 d) ingest-scoped JWTs (`POST /auth/tokens`), revocable,
   valid **only** for `POST /captures` — a leaked phone secret can't read the account.
7. **Transfers are first-class**: `POST /transfers` atomically creates the expense/income pair
   sharing a `transfer_group_id`; RBAC write role required on both ends; legs individually
   immutable (`400` on PUT/DELETE; group delete removes both).
8. **Mobile surface**: sources manager + review inbox under a Settings stack; transfer form off the
   Dashboard header; provenance badges (`auto`/`transfer`) on transaction rows; new RTK Query files
   `sources.js`/`captures.js`/`transfers.js` with tags `Source`/`Capture`. `team_id` travels in a
   body **only** in the confirm-override and transfer contracts.

## Consequences

- iOS Shortcuts / Android MacroDroid can auto-post today with zero native code — the app stays in
  Expo Go (ADR-003 intact).
- Every future capture path (native Android listener, aggregator feed) is just another `channel`
  writing into the same pipeline; the model doesn't change.
- Duplicates collapse deterministically; "first capture survives" — the bank-canonical preference
  from the research doc is a deferred refinement.
- The inbox teaches nothing by itself: linking posts one capture; adding an alias auto-routes the
  next ones.

## North star (aim high, ship lean)

- **Aggregator feed (Belvo/Plaid)** on the backend as the reliability layer — settled, complete,
  cross-platform — with automations remaining the instant layer.
- Native Android `NotificationListenerService` as the first dev-build feature (ADR-003's prebuild
  moment), parsing on-device.
- Retro-detection of transfer-like expense/income pairs ("link as transfer").

## Alternatives considered

- **Review-first inbox for everything** — rejected: the feature loses its "automatic" value.
- **Client-side resolution** — rejected: N devices × M channels of logic, unfixable without app
  updates, and raw text would need to reach the server for cross-device dedup.
- **Routing by active app context** — impossible for automations; deterministic per-source rule wins.
- **FinanceKit / wallet APIs** — not viable (MX cards not covered; no third-party read API).
