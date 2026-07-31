# Feature: Cache trust gate, skeleton loading states, and the mutation-feedback contract

The following plan should be complete, but it's important that you validate documentation and codebase
patterns and task sanity before you start implementing.

Read `.claude/ADR/ADR-019-cache-trust-and-loading-contract.md` **first** — it is the rationale for every
task here, and the invariant it states is the acceptance bar.

## Feature Description

Close a class of money-safety bug and make loading state honest app-wide. Four connected changes:

1. **Fix the logout teardown divergence** — the 401 auto-logout path forgets to reset the team context,
   leaving a persisted `activeTeamId` pointing at a team the user may no longer be viewing.
2. **Gate money on a confirmed context** — never render a figure until the app knows whose money it is.
3. **Honest loading surfaces** — shimmer skeletons for fixed layouts, spinner for lists, and a visible
   `offline · updated <time>` marker when cached figures are shown unrevalidated.
4. **The mutation-feedback contract** — every control that triggers a write shows its own pending state
   and surfaces its own failure, with per-row tracking where one hook serves many rows.

## User Story

As a **person checking my finances on a flaky connection**
I want **the app to show me nothing rather than the wrong number, tell me when data is stale, and give me
feedback when I tap something**
So that **I never mistake another context's money for my own, and I never wonder whether my tap
registered**

## Problem Statement

Verified defects, each with a located root cause:

- **P1 — Teardown divergence.** `src/screens/Settings/index.jsx:60-63` (manual logout) dispatches
  `clearAuth()` + `resetContext()` + `resetApiState()`. `src/services/api/baseApi.js:28-32` (401
  auto-logout) dispatches `clearAuth()` + `resetApiState()` — **`resetContext()` is missing**. Since
  `context` is in the redux-persist whitelist (`src/store/index.js:35`), the stale `activeTeamId`
  survives a cold start. `resetContext` is currently dead code outside Settings.
- **P2 — Money under an unconfirmed context.** `src/hooks/useTheme.js:22` reads the teams cache
  non-fetching (correctly — see `:13-17`), so when the roster is absent the accent falls back to
  `DEFAULT_ACCENT` (`:25-26`) and the Dashboard renders no team chips with nothing marked active, while
  `/balance?team_id=N` still paints team figures. Team money, personal-looking chrome.
- **P3 — Reactive auto-logout.** `app/_layout.jsx:24-34` hydrates the token without validating it; the
  401 interceptor fires only after some request happens to fail. An expired session renders a complete
  app over persisted cache, and work started in it is discarded.
- **P4 — Missing mutation feedback.** `src/screens/ShoppingLists/DetailScreen.jsx:42` destructures
  `useUpdateItemMutation()` with **no loading flag**, so item save and checkbox toggle show nothing on a
  slow network. `toggle` (`:90`) omits `.unwrap()`, so failures are silent.

## Solution Statement

One derived hook (`useContextReady`) is the single authority on the invariant "a figure is never rendered
under an unconfirmed context." The `GET /teams` the tabs layout **already fires** is promoted to the boot
session probe, answering session-validity and context-confirmation in one request with no backend change.
A `Skeleton` atom gives fixed layouts an honest placeholder. A shared `hardLogout` routine makes the two
teardown paths structurally identical. The loading contract is applied at the known-bad call sites and
written into CLAUDE.md so it stops decaying.

## Feature Metadata

**Feature Type**: Bug Fix + Enhancement (architectural — amends ADR-007)
**Estimated Complexity**: Medium-High (touches the boot path)
**Primary Systems Affected**: `src/services/api/baseApi.js`, `src/hooks/`, `src/components/ui/`,
`src/screens/Dashboard/`, `src/screens/ShoppingLists/`, `app/(tabs)/_layout.jsx`, `src/i18n/locales/*`
**Dependencies**: **None new.** Offline is inferred from RTK Query error shapes — do NOT add
`@react-native-community/netinfo` (not an Expo-SDK module → breaks Expo Go, ADR-003) or `expo-network`
(deferred per ADR-019).

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING

- `.claude/ADR/ADR-019-cache-trust-and-loading-contract.md` — **read first**, the whole thing.
- `.claude/ADR/ADR-007-persistence-and-offline-strategy.md` — Why: the decision being amended; the
  offline-reads goal that the stale-marker path must preserve.
- `src/services/api/baseApi.js` (lines 20-36) — Why: the 401 interceptor; P1 lands here. Note it already
  avoids a circular import by using `baseApi.util` rather than the persistor (`:30-31`).
- `src/screens/Settings/index.jsx` (lines 55-70) — Why: the **correct** teardown sequence to extract.
- `src/reducers/context/index.js` (whole file) — Why: `resetContext` at `:17`; the stale doc comment at
  `:4` that this plan makes true.
- `src/reducers/auth/index.js` (lines 20-45) — Why: `hydrateAuth` / `clearAuth` / `selectIsAuthed` /
  `selectBootstrapped`; note `bypass` short-circuits `selectIsAuthed` (dev-only, must not be gated).
- `src/store/index.js` (lines 29-38) — Why: the persist whitelist that keeps `context` alive across cold
  starts; `PersistGate` means rehydration completes before first render.
- `src/hooks/useTheme.js` (whole file, 29 lines) — Why: the desync source in P2. **Do not add a fetching
  subscription here** — `:13-17` documents why that causes a request storm.
- `src/hooks/useActiveRole.js`, `src/hooks/useActiveTeamId.js` — Why: the derived-hook pattern
  `useContextReady` must follow (derived, never stored).
- `app/(tabs)/_layout.jsx` (lines 16-33) — Why: **already owns the real `useGetTeamsQuery` subscription**
  (`:25`) and already falls back to personal when a team vanishes (`:28-32`). The probe and the gate both
  belong near here.
- `app/_layout.jsx` (lines 20-43, 51-68) — Why: `Bootstrap` + `PersistGate` + `AnimatedSplash` ordering;
  P3's probe must not fight the splash handoff.
- `app/index.jsx` — Why: the boot redirect (`(tabs)` vs `(auth)`).
- `src/components/ui/QueryBoundary.jsx` (whole file) — Why: the existing loading/error/empty wrapper that
  lists keep using; skeletons are an alternative branch, not a replacement.
- `src/components/ui/BrandSpinner.jsx` — Why: the atom shape to mirror for `Skeleton` (pure `Animated`,
  no svg/lottie, Expo-Go safe) and the loader lists keep.
- `src/components/ui/Button.jsx` (lines 5, 15, 19, 24) — Why: `loading`/`success`/`disabled` already
  exist and already render an `ActivityIndicator`. **Do not rebuild this.**
- `src/screens/ShoppingLists/DetailScreen.jsx` (lines 40-44, 76-113) — Why: P4's call sites —
  `updateItem` without a flag (`:42`), `toggle` without `.unwrap()` (`:90`), `saveEdit` (`:98-113`).
  Contrast with the correct usage at `:41,43,44` (`adding`, `checkingOut`, `deleting`).
- `src/screens/Dashboard/index.jsx` (lines 104-155) — Why: the primary skeleton consumer.
- `src/components/theme.js` (lines 7-33, 55-60) — Why: `border`/`card`/`muted` tokens for the shimmer;
  `makeColors` is pure and theme-aware.
- `src/utils/dates.js` — Why: check whether a relative-time helper exists before writing one; `luxon` is
  already a dependency (`toRelative()`).
- `src/test-utils/renderWithStore.jsx` — Why: the render helper every screen test uses.

### ⚠️ Ordering dependency

**Plan 008 must merge before this plan starts.** Plan 008 rewrites the Dashboard hero
(`src/screens/Dashboard/index.jsx:112-125`) into a `CyclingFigure`, and Task 10 here wraps that same hero
in a skeleton gate. Executing them in parallel guarantees a conflict in that file. If 008 has not merged,
stop and say so rather than working around it.

### New Files to Create

- `src/hooks/useContextReady.js` — the invariant hook.
- `src/hooks/useContextReady.test.js` — its behavior tests.
- `src/components/ui/Skeleton.jsx` — shimmer placeholder atom.
- `src/components/ui/Skeleton.test.jsx`
- `src/components/ui/StaleBadge.jsx` — the `offline · updated <time>` marker.
- `src/services/api/hardLogout.js` — the one teardown routine (see Task 1 for why it is its own file).

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [RTK Query — `QueryStatus` / hook result fields](https://redux-toolkit.js.org/rtk-query/usage/queries#frequently-used-query-hook-return-values)
  - Section: `isLoading` vs `isFetching` vs `fulfilledTimeStamp` vs `isUninitialized`
  - Why: the gate depends on the distinction. `isLoading` is *first* load only (no data yet);
    `isFetching` is any in-flight request including a revalidation over persisted data.
    `fulfilledTimeStamp` is the "last updated" source for the stale marker.
- [RTK Query — error shapes](https://redux-toolkit.js.org/rtk-query/usage-with-typescript#type-safe-error-handling)
  - Section: `FetchBaseQueryError` — `status` is `'FETCH_ERROR' | 'TIMEOUT_ERROR' | 'PARSING_ERROR' | number`
  - Why: offline is inferred from `FETCH_ERROR`/`TIMEOUT_ERROR` (no netinfo dependency).
- [RTK Query — `selectFromResult` / `useQueryState`](https://redux-toolkit.js.org/rtk-query/usage/queries#selecting-data-from-a-query-result)
  - Why: `useContextReady` must read the teams cache **without** subscribing to a fetch, same as
    `useTheme.js:22`.
- [React Native `Animated` — looping animations](https://reactnative.dev/docs/animated#loop)
  - Why: the shimmer. Mirror `BrandSpinner.jsx:11-23`; `useNativeDriver: true` for `opacity`/`transform`.
- [Luxon — `DateTime.toRelative()`](https://moment.github.io/luxon/api-docs/index.html#datetimetorelative)
  - Why: "updated 2h ago". Luxon is already a dependency — do not add `dayjs`/`date-fns`.
- [expo-router — `Redirect`](https://docs.expo.dev/router/advanced/authentication/)
  - Why: the boot gate reuses the existing `<Redirect href="/(auth)/login" />` at `(tabs)/_layout.jsx:34`.

### Patterns to Follow

**Derived hooks, never stored state** (`src/hooks/useActiveRole.js`, `useTheme.js`):

```js
export const useContextReady = () => {
  const teamId = useActiveTeamId();
  const { data: teams, isFetching, fulfilledTimeStamp, error } =
    teamsApi.endpoints.getTeams.useQueryState();
  // ...derive, return. Never useState, never dispatch.
};
```

**Non-fetching cache reads** — `useQueryState()`, **not** `useGetTeamsQuery()`, in anything that renders
inside a list row or a themed atom. The real subscription is owned by the long-lived screens
(`app/(tabs)/_layout.jsx:25`, Dashboard, Teams). See the warning at `useTheme.js:13-17`.

**Theming (ADR-013)** — `useTheme()` + `const styles = makeStyles(colors)`. No static color imports, no
hardcoded `'#fff'`.

**React Compiler is on** — no `useCallback`/`useMemo` for identity. Existing ones stay.

**Tests assert behavior, never design** (memory `feedback-test-behavior-not-design`).

---

## IMPLEMENTATION PLAN

### Phase 1: Correctness (the actual bug — smallest, highest value, ship-able alone)

Tasks 1-2. Fixes P1. Independently valuable: even with nothing else, a session expiry stops leaving a
stale team context behind.

### Phase 2: The gate primitives

Tasks 3-6. `useContextReady`, `Skeleton`, `StaleBadge`, i18n. All new files — no conflicts.

### Phase 3: Applying the gate

Tasks 7-10. Boot probe + Dashboard + the other money screens.

### Phase 4: The mutation-feedback contract

Tasks 11-12. Fixes P4 and writes the convention down.

### Phase 5: Validation

Task 13.

---

## STEP-BY-STEP TASKS

### Task 1 — CREATE `src/services/api/hardLogout.js`

- **IMPLEMENT**: One routine both logout paths call:
  ```js
  // The ONE teardown. Manual logout and the 401 interceptor MUST both go through here — they diverged
  // once (the 401 path forgot resetContext, stranding a persisted activeTeamId) and that divergence is
  // exactly what an unshared code path produces. (ADR-019)
  export const hardLogout = async (dispatch) => {
    dispatch(clearAuth());
    dispatch(resetContext());
    await clearToken();
    dispatch(baseApi.util.resetApiState());
  };
  ```
- **PATTERN**: `src/screens/Settings/index.jsx:60-63` — the correct sequence, verbatim, plus
  `clearToken()` from `baseApi.js:29`.
- **IMPORTS**: `clearAuth` from `'../../reducers/auth'`; `resetContext` from `'../../reducers/context'`;
  `clearToken` from `'../storage/secure'`; `baseApi` from `'./baseApi'`.
- **GOTCHA**: **Its own file on purpose.** Putting it in `baseApi.js` creates an import cycle
  (`baseApi` → `hardLogout` → `baseApi`); the existing code already dances around this at `:30-31`.
  A separate module that imports `baseApi` and is imported *only* by call sites keeps the graph acyclic.
  Order matters: `resetApiState()` last, so the cache wipe cannot trigger a refetch while a token is
  still attached. Do **not** touch `prefs` (a device preference that survives logout, per CLAUDE.md) or
  `activity` — wait, **do** reset `activity`: CLAUDE.md states `activity` is account data reset on logout
  like `context`. Check `src/reducers/activity/index.js` for the reset action's real name and include it;
  if Settings' logout does not currently reset it either, that is a second instance of the same bug —
  fix it here and note it.
- **VALIDATE**: `npx jest src/services/api`

### Task 2 — UPDATE `src/services/api/baseApi.js` and `src/screens/Settings/index.jsx` to use it

- **IMPLEMENT**: Replace the three-dispatch block at `baseApi.js:28-32` with `await hardLogout(api.dispatch)`,
  and the block at `Settings/index.jsx:60-63` likewise. Keep the `api.endpoint !== 'login'` exemption
  (`baseApi.js:27`) — a bad password must surface inline, not blow away the session.
- **PATTERN**: n/a — a substitution.
- **GOTCHA**: `hardLogout` imports `baseApi`, and `baseApi.js` must import `hardLogout` — resolve by
  importing it **lazily inside the interceptor** (`const { hardLogout } = require('./hardLogout')`) or by
  having `hardLogout` take the api util as a parameter. Pick one, comment which and why. This is the same
  class of problem the existing comment at `:30-31` describes; do not regress it.
  Write a test asserting a 401 on a non-login endpoint clears **`context.activeTeamId`** — that assertion
  is the regression guard for the original bug and must exist.
- **VALIDATE**: `npx jest src/services/api/baseApi.test.js --verbose`

### Task 3 — CREATE `src/hooks/useContextReady.js`

- **IMPLEMENT**: The single authority on the ADR-019 invariant.
  ```js
  // Returns { confirmed, stale, offline, lastUpdated }.
  //   confirmed — personal (teamId == null) is confirmed by definition; a team context is confirmed only
  //               when that id resolves in the getTeams cache (persisted counts — team identity is
  //               slow-moving, so offline confirmation is legitimate). (ADR-019)
  //   stale     — the money query could not be revalidated this session but cached data exists.
  //   offline   — inferred from RTK Query's FETCH_ERROR / TIMEOUT_ERROR (no netinfo dep — ADR-003).
  ```
  Signature: `useContextReady(query)` where `query` is the caller's money-query result (so `stale`/
  `lastUpdated` describe *that* screen's data), or no-arg for a confirmation-only check. Keep it one
  function; do not split into two hooks.
  - `confirmed = teamId == null || !!teams?.some((tm) => tm.id === teamId)`
  - `offline = isFetchError(query?.error) || isFetchError(teamsError)` where `isFetchError` checks
    `status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR'`
  - `stale = !!query?.data && (offline || (!query.isFetching && !!query.error))`
  - `lastUpdated = query?.fulfilledTimeStamp ?? null`
- **PATTERN**: `src/hooks/useTheme.js:18-29` — same shape, same `useQueryState` cache read, same
  derived-only discipline.
- **IMPORTS**: `teamsApi` from `'../services/api/teams'`; `useActiveTeamId` from `'./useActiveTeamId'`.
- **GOTCHA**: **`useQueryState()`, never `useGetTeamsQuery()`** — this hook will be called from screens
  and potentially rows; a fetching subscription reproduces the request storm documented at
  `useTheme.js:13-17`. Also: **dev bypass must not be gated into a dead end.** Check how `AUTH_BYPASS`
  interacts — in bypass mode `/teams` may not resolve meaningfully; confirm the hook still returns
  `confirmed: true` for personal context so bypass dev flow is unaffected.
  `fulfilledTimeStamp` persists through redux-persist, so on a cold start it correctly reports the *old*
  fetch time — that is the desired behavior for the stale marker, not a bug to normalize away.
- **VALIDATE**: `npx jest src/hooks/useContextReady.test.js` — cover: personal is always confirmed;
  team confirmed when present in cache; team **not** confirmed when the cache is empty (the P2 case);
  team not confirmed when the cache has other teams but not this id; `offline` true on `FETCH_ERROR`;
  `stale` false while a first load is in flight.

### Task 4 — CREATE `src/components/ui/Skeleton.jsx` (+ barrel export + test)

- **IMPLEMENT**: A shimmer placeholder that occupies fixed geometry.
  ```jsx
  export const Skeleton = ({ width = '100%', height = 16, radius: r = 6, style }) => { /* ... */ }
  ```
  A looping `Animated` opacity pulse (≈0.35 ↔ 0.75) over a `colors.border`-tinted block. Add
  `accessibilityRole="progressbar"` and `accessibilityLabel` from i18n so the state is announced —
  a silent placeholder is invisible to a screen reader.
- **PATTERN**: `src/components/ui/BrandSpinner.jsx:7-38` — the atom shape: `useRef(new Animated.Value)`,
  `Animated.loop`, `loop.stop()` in the effect cleanup, `useNativeDriver: true`, `useTheme()` for color.
- **IMPORTS**: `{ useEffect, useRef }`, `{ Animated }` from react-native, `useTheme`, `{ radius }` from
  `'../theme'`.
- **GOTCHA**: **`useNativeDriver: true` works for `opacity`** — do not animate `backgroundColor` or
  `width`, which the native driver cannot handle and which would silently fall back or warn. Stop the
  loop on unmount (`BrandSpinner.jsx:22`) or the animation leaks on every list re-render.
  Export from `src/components/ui/index.js`.
- **VALIDATE**: `npx jest src/components/ui/Skeleton.test.jsx` — renders, and unmounts without a
  "state update on unmounted component" warning.

### Task 5 — CREATE `src/components/ui/StaleBadge.jsx` (+ barrel export)

- **IMPLEMENT**: A small inline marker: a muted dot + `offline · updated 2h ago`, from
  `{ lastUpdated, offline }`. Renders `null` when `!offline && !lastUpdated`. Relative time via luxon
  `DateTime.fromMillis(lastUpdated).toRelative({ locale: i18n.language })`.
- **PATTERN**: `src/screens/Dashboard/index.jsx:104-109` (the `roleBadge` `Muted`) for the visual weight;
  `src/utils/dates.js` for luxon usage conventions.
- **IMPORTS**: check `src/utils/dates.js` **first** — if a relative-time helper exists, use it; if not,
  add one there rather than inlining luxon in a component (dates live in `utils/dates.js` by convention).
- **GOTCHA**: On the Dashboard hero this sits on the **accent background** — it must accept a color prop
  and the hero must pass `colors.primaryText` (ADR-013), never a hardcoded muted grey which could vanish
  against a dark accent.
- **VALIDATE**: `npx jest src/components/ui`

### Task 6 — UPDATE `src/i18n/locales/en-US.json` and `es-MX.json`

- **IMPLEMENT**: Add under `common`:
  - `"loading": "Loading"` / `"Cargando"`
  - `"offline": "Offline"` / `"Sin conexión"`
  - `"updatedAgo": "updated {{when}}"` / `"actualizado {{when}}"`
  - `"confirmingContext": "Confirming your context…"` / `"Confirmando tu contexto…"`
- **PATTERN**: existing `common.*` entries.
- **GOTCHA**: Both files. Run the key-parity script from plan 008 Task 4.
- **VALIDATE**: the i18n parity script (plan 008, Task 4).

### Task 7 — ADD the boot session probe to `app/(tabs)/_layout.jsx`

- **IMPLEMENT**: The `useGetTeamsQuery` at `:25` already runs; promote it to the gate.
  - While it is on its **first** load with no cached roster (`isUninitialized || (isLoading && !data)`)
    **and** `activeTeamId != null`, render a full-screen branded loading state instead of `<Tabs>` —
    `BrandSpinner` + `t('common.confirmingContext')`.
  - A `401` needs no new code: the interceptor (Task 2) clears auth, `selectIsAuthed` flips, and the
    existing `<Redirect href="/(auth)/login" />` at `:34` fires — **now before any screen paints**, which
    is the whole of P3's fix.
  - Keep the existing stale-team fallback effect (`:28-32`) exactly as is; it complements the gate.
- **PATTERN**: `app/(tabs)/_layout.jsx:34` — the existing `Redirect` guard.
- **GOTCHA**: **Do not gate personal context on the roster.** `activeTeamId == null` needs no team data;
  gating it would block the most common path on every cold start for nothing. **Do not gate when cached
  roster data exists** — that is the offline path, which must reach the screens so they can render
  cached figures with a `StaleBadge`. **Do not block forever:** if the probe errors with
  `FETCH_ERROR` and there is no cached roster, fall through to the screens (they will show skeletons +
  offline state via `useContextReady`) rather than trapping the user on a spinner.
  Verify interaction with `AnimatedSplash` (`app/_layout.jsx:40`) — the handoff overlay animates over
  whatever is beneath; make sure the gate does not cause a flash between splash and spinner.
  **`AUTH_BYPASS` dev mode must not be blocked.**
- **VALIDATE**: `npx jest` + manual Level 4 items 1-4.

### Task 8 — APPLY the gate to `src/screens/Dashboard/index.jsx`

- **IMPLEMENT**:
  - `const { confirmed, stale, offline, lastUpdated } = useContextReady(balanceQuery);` (destructure the
    full `useGetBalanceQuery` result, not just `data`).
  - **Hero:** when `!confirmed`, render the hero `Card` with `Skeleton` blocks in the label and figure
    positions — same geometry, no numbers, no zeros. When confirmed and `stale`, render the figures plus
    a `<StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.primaryText} />`.
  - **Vault rows:** when `!confirmed`, render 2-3 skeleton `Card`s matching `VaultRow` geometry.
  - **Context chips:** while the roster is unknown, the chip row must **not** imply personal. Render a
    skeleton chip rather than a lone unselected "Personal" chip — the misleading affordance from P2.
- **PATTERN**: plan 008 leaves the hero as a `CyclingFigure` inside `Card style={styles.hero}` — wrap the
  `CyclingFigure`, do not reimplement it.
- **GOTCHA**: **Never render `0` as a placeholder.** `data?.total` is `undefined` before load and
  `MoneyText` coerces nullish to `0.00` (`money.js:3`) — that is exactly the "number I didn't expect"
  failure. The skeleton must replace the `MoneyText` entirely, not wrap it.
  Depends on plan 008 having merged (see the ordering warning above).
- **VALIDATE**: `npx jest src/screens/Dashboard --verbose`

### Task 9 — APPLY the gate to the remaining money screens

- **IMPLEMENT**: `src/screens/Transactions/ListScreen.jsx` (the totals bar), `src/screens/Vaults/`
  (`ListScreen`, `DetailScreen`), `src/screens/Loans/` (`ListScreen`, `DetailScreen`).
  - **Fixed-geometry figures** (totals bar, detail headline figures) → `Skeleton` while `!confirmed`.
  - **Variable-length lists** → keep `QueryBoundary` + `BrandSpinner` unchanged (a skeleton cannot
    honestly predict a row count — ADR-019).
  - Add a `StaleBadge` to each screen's primary figure area when `stale`.
- **PATTERN**: Task 8's Dashboard treatment.
- **GOTCHA**: Do **not** convert list screens to skeletons. The decision is explicitly split by layout
  type. Touch `Transactions/ListScreen.jsx` only after plan 008's changes to it are merged.
- **VALIDATE**: `npx jest src/screens`

### Task 10 — UPDATE `src/hooks/useTheme.js` — accent honesty (small, careful)

- **IMPLEMENT**: When `teamId != null` but the roster has not confirmed it, `useTheme` currently returns
  `DEFAULT_ACCENT` — which *reads as personal*. Return an additional `accentConfirmed: false` flag so
  chrome consumers can render a neutral/skeleton treatment instead of a confident personal accent.
  **Do not change the returned `colors`** — every atom depends on a valid palette.
- **PATTERN**: `useTheme.js:24-28` — add to the returned object, change nothing else.
- **GOTCHA**: This hook runs in **every themed atom**. Adding a field is free; adding a fetch, a
  subscription, or extra work is not. Do not touch `:22`'s `useQueryState`. Keep the diff to a few lines.
- **VALIDATE**: `npx jest src/hooks/useTheme.test.js`

### Task 11 — FIX the mutation feedback in `src/screens/ShoppingLists/DetailScreen.jsx`

- **IMPLEMENT**:
  - Destructure the flag: `const [updateItem, { isLoading: updating }] = useUpdateItemMutation();` (`:42`).
  - **Per-row pending state.** A single `updating` would spin every row at once. Track the in-flight row:
    `const [busyId, setBusyId] = useState(null);` set around both `toggle` and `saveEdit`; a row shows an
    inline `ActivityIndicator` (and disables its controls) when `busyId === item.id`.
  - **`toggle` must `.unwrap()`** inside `try/catch` with the same `Alert.alert(t('common.error'), …)`
    treatment as `onAddItem` (`:84-86`) — today a failed toggle is silent (`:90`).
  - `saveEdit`'s save button: `<AppButton loading={busyId === item.id} … />`.
- **PATTERN**: `DetailScreen.jsx:76-88` (`onAddItem`) — the correct shape: `try { await x().unwrap() }
  catch (e) { Alert.alert(t('common.error'), e?.message ?? '') }`.
- **GOTCHA**: The checkbox is an optimistic-feeling control — on failure it must visibly **revert**, not
  just alert. Since there is no optimistic update configured, the cache simply never changes, so the
  revert is automatic; verify this holds rather than assuming it. Do not add `optimisticUpdates` in this
  task — out of scope.
- **VALIDATE**: `npx jest src/screens/ShoppingLists --verbose` — add tests: a failing update surfaces an
  error and leaves the item unchanged; a pending update disables that row's control **and no other row's**.

### Task 12 — AUDIT every mutation call site + write the contract into CLAUDE.md

- **IMPLEMENT**:
  - Enumerate every `useXMutation()` destructure across `src/screens/`:
    ```bash
    grep -rn "use[A-Za-z]*Mutation()" src/screens/
    ```
    For each, confirm (a) a loading flag is destructured **and bound to its control**, and (b) the call
    uses `.unwrap()` in a `try/catch`. Fix any that do not. Report the list of sites fixed.
  - Add a **Conventions** bullet to `CLAUDE.md` stating the contract (ADR-019): every mutation-triggering
    control reflects its own pending state via `AppButton loading` (or an inline indicator for icon/row
    controls); every mutation uses `.unwrap()` in `try/catch`; where one hook serves many rows, pending
    state is tracked **per row id**.
  - Add ADR-019 to the ADR index table in `.claude/ADR/README.md`.
- **GOTCHA**: ADR-014 is absent from the index (it jumps 013 → 015) — that is pre-existing, leave it be.
  Keep the CLAUDE.md addition to 3-4 lines in the existing terse style; it is a rule, not an essay.
- **VALIDATE**: `grep -rn "use[A-Za-z]*Mutation()" src/screens/` reviewed; `npx jest`

### Task 13 — Full validation

- **VALIDATE**: every command in the section below.

---

## TESTING STRATEGY

Framework: jest + `jest-expo` + RNTL v13 (ADR-010), `renderWithStore` helper. Behavior only.

### Unit Tests

- `useContextReady` — the confirmation matrix (personal / team-in-cache / team-not-in-cache / empty
  cache), `offline` inference from error shape, `stale` derivation.
- `Skeleton` — renders, animates, unmounts cleanly.
- `hardLogout` / `baseApi` — **a 401 clears `context.activeTeamId`** (the P1 regression guard).

### Integration Tests

- Dashboard — with an unconfirmed team context: **no monetary text is rendered at all** (assert the
  absence of any `/\d/`-matching money node, not just of a specific value); skeletons present. With a
  confirmed context: figures render. With `stale`: figures **plus** the offline marker.
- Tabs layout — an unconfirmed team context with no cached roster renders the gate, not `<Tabs>`;
  personal context renders `<Tabs>` immediately.
- ShoppingLists detail — per-row pending isolation; failed toggle surfaces an error and does not flip.

### Edge Cases

- Team context + **empty** roster cache (the exact P2 state) → gate holds, zero figures rendered.
- Session expires mid-session → `resetContext` runs → next cold start opens in **personal**, not a
  phantom team.
- Offline cold start **with** cached roster → screens render cached figures + `StaleBadge`, correct accent.
- Offline cold start **without** cached roster → falls through to skeletons; **must not trap** the user
  on an infinite spinner.
- `AUTH_BYPASS=true` dev mode → never gated, never blocked.
- Rapid context switching → no flash of the previous context's figures between switches (assert the gate
  closes on `activeTeamId` change).
- Vault/loan/transaction figures of `0` that are **genuinely** zero → must render as `0.00`, not as a
  skeleton. Confirmed-and-zero is not the same state as unconfirmed.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npx expo-doctor
npx expo-modules-autolinking verify -v   # no non-SDK native module crept in (ADR-003)
```

### Level 2 & 3: Tests

```bash
npx jest src/hooks src/components src/services
npx jest src/screens
npx jest            # full suite — must be green
```

### Level 4: Manual Validation

```bash
cd ../../Node/Projects/balance && NODE_ENV=stage npm start
APP_ENV=dev npx expo start
```

1. **The original bug.** Switch to a team → force a 401 (stop the backend / invalidate the token) →
   trigger a request → confirm you land on login. Restart the app, log in: it opens in **personal**, with
   personal figures and the default accent. No team numbers, ever.
2. **Slow-network cold start.** Throttle to 3G/offline (iOS: Network Link Conditioner; Android: emulator
   network settings). Cold start in a team context → skeletons, **no figures**, until the roster
   confirms. Never a `0.00` placeholder.
3. **Offline with cache.** Load a team context online, kill the network, cold start → figures render with
   `offline · updated <time>`, accent correct, **not blank** (this is ADR-007's preserved offline read).
4. **Offline without cache.** Clear app data, go offline, cold start → skeletons + an offline state with
   a retry affordance. **Confirm you are not trapped on a spinner.**
5. **Mutation feedback.** Throttle the network, edit a shopping-list item → the save button spins and
   **only that row** shows pending. Toggle a checkbox offline → it reverts **and** shows an error.
6. **Context switch.** Switch team → personal → team rapidly. No frame ever shows one context's figures
   under another's chrome.
7. **Bypass mode.** `AUTH_BYPASS=true` → app boots straight through, no gate.
8. Light + dark, personal + a custom-accent team: skeletons and `StaleBadge` are legible in all four.

---

## ACCEPTANCE CRITERIA

- [ ] A 401 auto-logout resets `context.activeTeamId` (regression test present).
- [ ] Both logout paths go through one `hardLogout` routine.
- [ ] No monetary figure renders anywhere while its context is unconfirmed — verified by asserting the
      **absence of any digits**, not of a specific value.
- [ ] `0.00` never appears as a loading placeholder; a genuine zero still renders.
- [ ] Fixed-geometry areas show skeletons; variable-length lists keep `BrandSpinner`.
- [ ] Cached-but-unrevalidated figures carry a visible `offline · updated <time>` marker.
- [ ] Offline with no cached roster falls through to a retryable state — never an infinite spinner.
- [ ] A dead session redirects to login **before** any screen paints.
- [ ] `AUTH_BYPASS` dev flow is unaffected.
- [ ] Every mutation call site in `src/screens/` binds a pending state and uses `.unwrap()` in `try/catch`.
- [ ] Per-row pending state does not spin sibling rows.
- [ ] The contract is written into CLAUDE.md; ADR-019 is in the ADR index.
- [ ] `npx jest` green; `npx expo-doctor` clean; no new native dependency.

---

## COMPLETION CHECKLIST

- [ ] Plan 008 merged before starting (hard dependency on `Dashboard/index.jsx` and
      `Transactions/ListScreen.jsx`)
- [ ] Phase 1 (Tasks 1-2) green and independently ship-able
- [ ] Each task validated immediately
- [ ] Manual Level 4 run on a **real device** with a **throttled network** — items 2, 3 and 4 cannot be
      verified in jest or on a fast simulator
- [ ] Acceptance criteria met
- [ ] ADR-019 index row added; CLAUDE.md conventions updated

---

## NOTES

### Why the boot probe needs no backend change

`app/(tabs)/_layout.jsx:25` already issues `GET /teams` on every boot. A `200` proves the token is valid
*and* returns the roster that confirms the context; a `401` runs the existing interceptor. One request
answers "is the session alive", "which teams exist", and "is the current context real". The backend has
no `/auth/me` (`auth/http/routes.js` exposes only `login`/`logout`) and does not need one. ADR-019 keeps
a lighter probe as a north star if boot latency ever justifies it.

### Why `stale` beats blank

The reported harm was **unlabelled** data, not stale data. Blanking cached figures offline would reverse
ADR-007's offline-reads goal to fix a labelling problem — a large availability cost for the wrong
diagnosis. Confirming the context from the persisted roster (identity data, slow-moving) and marking the
money's age keeps both properties.

### Scope boundaries

Not in this plan: optimistic updates, an offline write queue (ADR-007 tier 3), `expo-network` adoption,
`/auth/me`, and JWT `exp` pre-checking. All recorded as ADR-019 north stars.

### Repo gotcha

`.gitignore` ignores all of `.claude/` — force-add:

```bash
git add -f .claude/ADR/ADR-019-cache-trust-and-loading-contract.md \
           .claude/agents/plans/009-cache-trust-and-loading-states.md
```

### Confidence

**7.5/10** for one-pass success — lower than plan 008 by design. The mechanical parts (Tasks 1-2, 4-6,
11) are high confidence. The risk concentrates in Task 7: the boot gate touches the splash → gate →
redirect ordering, where the failure mode is an infinite spinner or a flash between states, and neither
is fully verifiable in jest. Ship Phase 1 first — it fixes the actual reported bug on its own and is
nearly risk-free.
