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
  Months ▾ · Custom ▾**. Months is one picker grouped by year; Custom is a lightweight from/to picker.
- Presets resolve to `{ from, to }` from the **device local date**; week starts Monday.
- All filters go to the server in one query; the list uses RTK Query `infiniteQuery` on `next_cursor`.
- Totals bar shows the server's `totals` for the whole filtered set.
- One shared query-string builder for API endpoints (transactions + events): `withQuery` in
  `src/services/api/queryString.js`.
- Custom range is two `YYYY-MM-DD` fields (same entry style as the transaction form) — no native
  date-picker dependency. A swapped pair is reordered; an input with no valid date is rejected inline.
- Page size is 30 (`PAGE_SIZE`). `loans` is a server filter (`loans=only`), not a client filter on `loan_id`.
- Totals come from page 1 of the *current* query (`currentData`), so a changing filter shows the skeleton
  rather than the previous filter's numbers; `count` drives the "N results" label.

## Consequences
- Client-side date filtering and totals code removed.
- Mutations keep invalidating the list tag so paged data refreshes (RTK refetches the loaded pages).
- The Months picker offers the current year and the four before it; older data is reachable via Custom.
- `GET /transactions` is a hard migration: this client requires the paged response shape.
