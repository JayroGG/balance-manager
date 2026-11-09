# ADR-005 — Data layer via RTK Query (supersedes PRD thunks)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Supersedes PRD §6.1/§6.2 (one Redux slice + `createAsyncThunk` per entity
  calling `services/API/*`, the `employee-mobile-app` pattern). Related: ADR-001 (token seam).

## Context

The app is a **thin client over a small REST API** (4 resources: balance, transactions, categories,
vaults). The team's existing pattern is manual `createSlice` + `createAsyncThunk` + `services/API/*` +
a central `errorHandler`, with hand-written loading/error state per entity. For pure CRUD this is a lot
of boilerplate, and cross-entity refresh (e.g. "after creating a transaction, re-fetch `/balance`") is
manual and easy to forget. RTK Query (part of Redux Toolkit, already in the stack) gives caching,
auto-refetch, dedup, and **tag-based invalidation** out of the box, in pure JS (Expo-Go safe).

## Decision

Use **RTK Query** as the data layer.

- **One base API** in `src/services/api/baseApi.js`: `createApi({ baseQuery: fetchBaseQuery({ baseUrl,
  prepareHeaders }) , tagTypes, endpoints: () => ({}) })`. `prepareHeaders` is the single token seam
  (ADR-001). `baseUrl` comes from `src/utils/config.js`.
- **One file per entity**, each calling `baseApi.injectEndpoints({ endpoints })` and re-exporting its
  generated hooks: `balance.js`, `transactions.js`, `categories.js`, `vaults.js`. This preserves the
  modular "a slice you can turn on/off" feel — deleting an entity = deleting its file + its import.
  (Note: `injectEndpoints` is about **code modularity / code-splitting**, not runtime memory; the cache
  is one normalized store tuned via `keepUnusedDataFor`.)
- **Tags:** `Balance`, `Transaction`, `Vault`, `VaultHistory`, `Category`. Mutations invalidate the
  right tags so the **dashboard auto-refreshes**: any transaction create/update/delete and any vault
  `allocate`/`withdraw` → `invalidatesTags: ['Balance','Vault', ...]` (balances/targets come from
  `GET /balance` per the PRD).
- **Errors:** `transformErrorResponse` surfaces the backend's `{ error }` message (PRD §4) as the
  user-facing string; components read `error`/`isError` from the query hooks.
- Components call generated hooks (`useGetBalanceQuery`, `useAddTransactionMutation`, …) — they never
  call `fetch` and never manage loading/error state by hand.

## Consequences

- **Positive:** far less boilerplate; correct, automatic cache invalidation across entities (the
  dashboard "just updates"); built-in loading/error/refetch/polling; one auth seam.
- **Positive:** still 100% Redux Toolkit and pure JS — no new native dependency, Expo-Go safe.
- **Negative / trade-offs:** different mental model from `employee-mobile-app`'s thunks; tag wiring must
  be deliberate or screens go stale. Mitigated by centralizing tag rules in each entity file and
  documenting them.
- **Follow-ups:** if a screen needs imperative/optimistic updates, use RTKQ `onQueryStarted` rather than
  reaching outside the seam.

## Alternatives considered

- **RTK slices + `createAsyncThunk` + `services/API/*` (PRD/team default).** Rejected: heavy boilerplate
  and manual cross-entity refresh for a thin CRUD client; RTK Query is the modern fit and already in RTK.
- **React Query (TanStack).** Rejected: would add a second state system alongside Redux; RTK Query reuses
  the store we already configure.
