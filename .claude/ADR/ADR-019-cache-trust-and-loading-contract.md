# ADR-019 — Cache trust: never render money under an unconfirmed context (+ the app-wide loading contract)

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Amends ADR-007 (cache persistence / offline reads). Related: ADR-011 (team
  context + 401 auto-logout), ADR-013 (theming seam), ADR-016 (brand loader), ADR-005 (RTK Query).

## Context

Three field-reported problems on a real device with a poor connection turned out to share one root:
**the app renders financial figures before it knows whose money it is, or whether the session is even
alive.**

### 1. The 401 auto-logout leaves a stale context behind

There are two logout paths and they do not do the same thing:

| | `clearAuth()` | `resetContext()` | `resetApiState()` |
|---|---|---|---|
| Manual logout — `src/screens/Settings/index.jsx:60-63` | ✅ | ✅ | ✅ |
| **401 auto-logout — `src/services/api/baseApi.js:28-32`** | ✅ | ❌ **missing** | ✅ |

`resetContext` exists (`src/reducers/context/index.js:17`) and is exported, but the 401 path never
dispatches it. Both the slice's own comment (`:4`) and CLAUDE.md document the invariant as "persisted,
**reset on logout**" — which is true for the manual path only. After a session expiry, `activeTeamId`
survives, **and it is in the redux-persist whitelist** (`src/store/index.js:35`), so it survives a cold
start too.

### 2. Money renders under the wrong context label

`useTheme` reads the teams cache with `useQueryState` — deliberately read-only and non-fetching, because
it runs inside every themed atom and a subscription there would cause a request storm
(`src/hooks/useTheme.js:13-17`). That is the right call, but it means the **accent** and the **money**
resolve from independent sources that can desync:

- `activeTeamId` = 5 (a team, possibly stale per problem 1)
- teams cache empty or still in flight → `useTheme:25-26` finds no team → falls back to `DEFAULT_ACCENT`
- Dashboard chip row (`src/screens/Dashboard/index.jsx:93-101`) renders no team chips, and the Personal
  chip's `active={teamId == null}` is `false` → **nothing appears selected**
- `/balance?team_id=5` resolves (live or from the persisted cache) → **team money paints**

Net effect: **team figures under personal-looking chrome.** For a finance app this is the worst class of
UI bug — not a cosmetic glitch but a number the user reads as *theirs* when it is not. The reporter's own
words: *"when I see numbers I don't expect, talking about money"* — an unnecessary alarm about their own
finances.

### 3. Auto-logout is reactive, so a dead session looks alive

`Bootstrap` (`app/_layout.jsx:24-34`) reads the token from secure-store and hydrates it **without ever
validating it**. The 401 interceptor only fires *after* some request happens to fail. With persisted
cache painting instantly (ADR-007), an expired session renders a complete, plausible app — the user can
browse and start composing writes — until the first failure retroactively logs them out and discards the
work. There is no `/auth/me` endpoint on the backend (`auth/http/routes.js` exposes only `login` and
`logout`), so a naive fix looks like it needs backend work. It does not — see the decision.

### 4. Loading feedback is inconsistent, so slow networks look like dead buttons

`AppButton` already supports `loading` and `success` (`src/components/ui/Button.jsx:5,24`) and most call
sites use it. But `useUpdateItemMutation` in the shopping-list detail screen is destructured **without**
its loading flag (`src/screens/ShoppingLists/DetailScreen.jsx:42`), so item save and the checkbox toggle
have no pending state at all; the toggle additionally omits `.unwrap()` (`:90`), so a failed request
fails **silently** and the checkbox simply springs back. The convention exists — it is unenforced, so it
decays with each new screen.

### The force this creates

ADR-007 deliberately chose persisted cache for "instant cold-start paint and offline **reads**
(stale-but-visible)". That decision is still right, but it was written about *availability* and never
stated a **trust** condition. Painting instantly is only safe if what is painted is unambiguously
labelled. Problems 1-3 are all instances of the missing condition.

## Decision

### The invariant

> **A monetary figure is never rendered unless the context that owns it is confirmed.**

"Confirmed" is defined narrowly and cheaply:

- `activeTeamId == null` → **confirmed by definition**. Personal money needs no roster lookup; there is
  no ambiguity to resolve.
- `activeTeamId != null` → **confirmed only when that id resolves to an entry in the `getTeams` cache.**
  The cache may be a persisted one — team identity is slow-moving data, so offline confirmation from
  persisted roster data is legitimate and keeps ADR-007's offline reads intact.
- Not confirmed → render **skeletons**, never figures, never zeros. A zero is a lie with a number in it.

### Now (this round)

- **Fix the teardown divergence.** The 401 path dispatches `resetContext()` alongside `clearAuth()` and
  `resetApiState()`. Extract one `hardLogout` routine so manual and automatic logout cannot drift again —
  the divergence in the table above is precisely what an unshared code path produces.
- **`useContextReady()` — one hook, the single authority on the invariant.** Returns
  `{ confirmed, stale, lastUpdated, offline }`. Every screen that renders money consults it. It is a
  derived hook with no stored state, matching the `useActiveRole` / `useTheme` precedent (ADR-012/013).
- **Boot-time session probe with no backend change.** `app/(tabs)/_layout.jsx:25` **already fires
  `GET /teams`** at boot. That single request is promoted to the session probe: `200` proves the session
  is alive *and* supplies the roster that confirms the context; `401` runs the existing interceptor and
  redirects to login **before any screen paints**. One request, three answers, zero new endpoints.
- **Stale-but-labelled, not blank.** When the roster confirms the context but the money could not be
  revalidated, show the cached figures **with a visible `offline · updated <relative time>` marker**
  rather than hiding them. This preserves ADR-007's offline reads while removing the ambiguity that
  actually caused harm. The danger was never staleness — it was *unlabelled* staleness.
- **Skeletons for fixed layouts, spinner for lists.** Screens with a known shape (Dashboard hero, vault
  rows, totals bars) render shimmer placeholders that occupy the final geometry — no layout jump, and no
  number to misread. Variable-length lists keep the existing `BrandSpinner` via `QueryBoundary`, since a
  skeleton cannot honestly predict a row count.
- **The loading contract, stated so it stops decaying:** every mutation-triggering control reflects its
  own pending state, and every mutation surfaces its failure. `AppButton` takes `loading`; icon/row
  controls disable and show an inline indicator; every call uses `.unwrap()` inside `try/catch`.
  Where one mutation hook serves many rows, pending state is tracked **per row id** — a shared
  `isLoading` would spin every row at once.

### North star (deferred)

- **Offline write queue.** Today writes still require the network and the contract's honest answer to a
  failed write is an error. ADR-007's tier-3 outbox is what turns that into "queued, will sync" — the
  `useContextReady` seam is where a queue-depth indicator would surface.
- **Real connectivity detection.** Offline is currently *inferred* from RTK Query error shapes
  (`FETCH_ERROR` / `TIMEOUT_ERROR`) rather than observed. `expo-network` is an Expo-SDK module and stays
  Expo-Go safe (ADR-003) if inference proves too coarse — deliberately not adopted yet, because a
  dependency that only sharpens a marker is not worth it until the marker itself is proven.
- **Server-driven session validity.** A real `/auth/me` (or token `exp` decoding client-side via the
  existing `decodeUser`) would let boot detect expiry without a round trip. Cheap follow-up, and the
  probe seam makes it a swap rather than a rewrite.

### Boundary (what makes the swap cheap)

All four mechanisms sit behind seams that already exist: the context gate is one hook, the probe is one
already-issued query, the teardown is one extracted routine, and the loading contract is props on an atom
that already supports them. Nothing here reaches into screen bodies except at the call sites that consume
the hook.

## Consequences

- **Positive:** money is never shown under the wrong owner — the class of bug is closed by construction,
  not patched per screen. A dead session is discovered before the user invests work in it. Slow networks
  produce visible feedback instead of dead controls. The teardown divergence that caused the original
  incident cannot recur once both paths share one routine.
- **Positive:** the invariant is enforceable in review — "does this screen render a figure without
  consulting `useContextReady`?" is a mechanical question, unlike "is this loading state adequate?"
- **Negative / trade-offs:** a genuine cold start on a bad connection now shows skeletons where it
  previously showed (untrustworthy) numbers — strictly slower to *something on screen*, deliberately.
  Offline detection is inferred, so a server 500 during an outage may read as "offline" rather than
  "broken". Per-row pending state adds a small amount of local state to list screens that a single shared
  flag would not.
- **Negative:** this amends ADR-007's "paint instantly" promise with a condition. ADR-007 is **not**
  superseded — cache persistence remains the strategy, and the offline-read goal is preserved by the
  stale-marker path. Only the unconditional form of the promise is withdrawn.
- **Follow-ups:** `.claude/agents/plans/009-cache-trust-and-loading-states.md`. The `expo-network` and
  `/auth/me` items above stay deferred. Plan 008 (UI density pass) is independent and lands first.

## Alternatives considered

- **Block all money until a live fetch succeeds.** Strictest and simplest to reason about, but it
  directly reverses ADR-007's offline-reads goal — the app becomes useless on a plane rather than merely
  stale. Rejected: the harm was unlabelled data, not stale data, and this option pays a large
  availability cost to fix a labelling problem.
- **Fix the accent fallback only** (make `useTheme` show *something* team-ish while the roster loads).
  Treats the symptom. The chrome would be less misleading while the underlying "we don't know whose money
  this is" condition persists — and it cannot fix problems 1 or 3 at all. Rejected.
- **Give `useTheme` a real fetching subscription** so the roster is always present. Rejected outright:
  `useTheme` runs in every themed atom, and the comment at `useTheme.js:13-17` documents that this
  produces a request storm on list screens. That is a known-bad path.
- **Add a `/auth/me` endpoint and a dedicated boot probe.** Clean in principle, but requires a backend
  change and a second boot round trip to learn what the existing `GET /teams` already proves. Rejected as
  redundant; kept as a north-star refinement if boot latency ever justifies a lighter probe.
- **A global "is the app ready" boolean in Redux.** Would centralise the gate but store derived state,
  violating the derived-not-stored rule that `useActiveRole` and `useTheme` both follow (ADR-012/013),
  and it would need invalidation on every context switch. Rejected in favour of a derived hook.
- **Per-screen ad-hoc loading fixes.** This is exactly how the current inconsistency arose — the
  convention existed and decayed because nothing named it. Rejected on the evidence.
