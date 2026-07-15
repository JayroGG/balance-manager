# ADR-017 — Activity feed (`GET /events`) as the notification surface

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Jayro (product/eng)
- **Supersedes / Related:** ADR-011 (team context, reset-on-logout semantics), ADR-013 (prefs vs.
  account-data persistence)

## Context

Team contexts are multi-user, but the app gives no visibility into other members' actions — a
teammate's expense only shows up as a silently-changed balance number. There is no notification
mechanism at all, and remote push (Expo Push) is blocked on a paid Apple Developer account, so it
isn't available for this phase. The backend now ships an append-only `GET /events` ledger
(`balance/docs/react-native-activity-feed-update.md`), context-scoped exactly like `/transactions`
and immutable server-side history — no write routes exist on it.

## Decision

- **Now (MVP):**
  - `GET /events` is consumed via a standard `injectEndpoints` file (`events.js`, tag `Event`),
    following the `transactions.js` filter-serialization + `withTeam` pattern. **Nothing invalidates
    `'Event'`** — no local mutation can know about another member's action, so freshness comes from
    the app-wide `refetchOnMountOrArgChange` (on-focus refetch) plus manual pull-to-refresh, matching
    the contract's "on-focus + manual refresh is enough for the MVP."
  - The feed **is** the notification surface for this phase — polling, not push.
  - A new `activity` slice persists a **per-context `lastSeen` event id**, advanced monotonically by
    `markSeen` (never regresses on a stale/racing refetch). It's keyed `'personal' | String(teamId)`
    and reset on logout, like `context` (ADR-011) — **not** folded into `prefs`, which is a device
    setting deliberately *not* reset on logout (ADR-013). `lastSeen` is account data, not a device
    preference.
  - `useUnreadActivity` compares the active context's `lastSeen` against `GET /events?since_id=` to
    drive an unread badge on a bell icon in the Dashboard header. Opening the feed marks it seen.
  - The feed screen (`src/screens/Activity`) lives under a new `dashboard/` stack
    (`app/(tabs)/dashboard/{_layout,index,activity}.jsx`), mirroring how `transactions/` nests a
    stack under one tab — the tab bar is already at six items, so activity rides along with the
    screen it's reachable from rather than claiming a new tab.
  - `entity=`/`action=` equality filters are threaded through `getEvents` (contract-supported) but
    the MVP screen has no filter UI — chips are a cheap screen-only follow-up.
- **North star (deferred):** Expo Push delivering these same events when the app is closed (backend
  ADR-009) — client work then is push-token registration + notification handlers; this feed and its
  data layer stay as-is, nothing here gets thrown away.
  - **Local notifications (`expo-notifications`) are deliberately DEFERRED**, not adopted now: while
    polling is focus-only, a local notification would fire while the user is already in-app, which is
    marginal value for a new native dependency. Skipping it also keeps the feature Expo Go safe — no
    new module, no dev-build requirement.
- **Boundary:** the `getEvents` query + `Event` tag are the seam. Swapping in remote push later means
  adding a token-registration flow and a handler that dispatches the same `markSeen`/cache-invalidate
  path an in-app feed open already exercises — the feed screen and unread logic don't change.

## Consequences

- **Positive:** teammates' actions become visible without any push infrastructure or new dependency;
  the unread badge gives a cheap "something happened" signal; the data layer and screen are the exact
  shape the eventual push north star needs, so nothing is thrown away when a paid Apple account
  unblocks Expo Push.
- **Negative / trade-offs:** the badge is **approximate**, not exact — it's capped by the `limit: 200`
  query (server max) so a very active team context could undercount; unread requires having opened
  the feed at least once to seed `lastSeen` (a context that's never been opened shows no badge at
  all, by design, until first open); there's no notification while the app is backgrounded or closed
  (the whole reason push is the north star); polling only happens on screen focus, so a live-open
  Dashboard doesn't see brand-new events until the next mount/refresh.
- **Follow-ups:** entity/action filter chips on the Activity screen (endpoint already supports them);
  Expo Push registration + handlers once a paid Apple Developer account exists (backend ADR-009).

## Alternatives considered

- **`expo-notifications` (local notifications) now** — rejected: fires while the user is already
  in-app given focus-only polling, so it adds a native dependency for marginal value; revisit once
  background polling or push exists.
- **WebSockets for live updates** — rejected: no backend support, and it's infrastructure a POC-scale
  single-server backend doesn't need yet; polling + `since_id` is enough for on-focus freshness.
- **Per-event read receipts (mark individual events read)** — rejected: over-engineered for a feed
  that's read top-to-bottom, newest-first; a single monotonic `lastSeen` id captures "seen up to here"
  with far less state.
