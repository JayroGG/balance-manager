# ADR-021 — Transactions search, date presets and infinite scroll

- **Status:** Accepted
- **Date:** 2026-11-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Supersedes the *History month/year filter* section of ADR-015 (client-side year/month
  filter). Related: ADR-005 (RTK Query), ADR-017 (shared list-query pattern with the events feed), ADR-019
  (loading contract), BE ADR-011 (`GET /transactions` search + keyset pagination).

## Context
The Transactions list fetched every row and filtered year/month on the device; totals were summed from
visible rows. No search. The BE now serves filtered, paged results with server totals (BE ADR-011).

## Decision
- Search bar (debounced) + date filter chips: **All (default) · Today · Yesterday · This week ·
  Months ▾ · Custom ▾**. Months is a compact year-stepper + 4×3 month grid; Custom is an in-repo calendar range picker.
- Presets resolve to `{ from, to }` from the **device local date**; week starts Monday.
- All filters go to the server in one query; the list uses RTK Query `infiniteQuery` on `next_cursor`.
- Totals bar shows the server's `totals` for the whole filtered set.
- One shared query-string builder for API endpoints (transactions + events): `withQuery` in
  `src/services/api/queryString.js`.
- **Months picker:** year header with ‹ › arrows (never past the current year, back 20 years) over a 4×3
  grid of short month names; the active month is highlighted and future months of the current year are
  disabled.
- **Custom range:** a small in-repo month calendar (`RangeCalendar`, Monday-first, localized) built on
  the `src/utils/dates.js` maths (`monthGrid`, `pickRangeDay`) — no date-picker dependency and no native
  module. First tap = start, second = end (earlier than the start swaps them; the same day twice = a
  single day), a third tap starts over; Apply/Cancel. Ranges are always closed, so `from`/`to` are both set.
- Page size is 30 (`PAGE_SIZE`). `loans` is a server filter (`loans=only`), not a client filter on `loan_id`.
- Totals come from page 1 of the *current* query (`currentData`), so a changing filter shows the skeleton
  rather than the previous filter's numbers; `count` drives the "N results" label.

## Consequences
- Client-side date filtering and totals code removed.
- Mutations keep invalidating the list tag so paged data refreshes (RTK refetches the loaded pages).
- The Months picker goes back 20 years; anything older is reachable via Custom.
- `GET /transactions` is a hard migration: this client requires the paged response shape.
