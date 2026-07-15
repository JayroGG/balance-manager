# Feature: Activity feed (`GET /events`) — feed screen per context + unread badge

The following plan should be complete, but validate documentation and codebase patterns and task
sanity before you start implementing. Pay special attention to naming of existing utils/models and
import paths.

## Feature Description

A read-only **activity feed** ("Ana added an expense of $12.50", "Luis checked Milk off Groceries")
consumed from the backend's new `GET /events` endpoint. The feed is context-scoped exactly like
`/transactions` (personal = your own actions; `?team_id=N` = everything every member did in that
team), newest first, immutable server-side history. The feed **is** the notification surface for
this phase: polled on screen focus + pull-to-refresh; an **unread badge** on a bell icon in the
Dashboard header is driven by a persisted last-seen event id per context + the `since_id` param.

**Scope decisions (locked with the user, 2026-07-15):**
- Local notifications (`expo-notifications`) are **DEFERRED** — recorded in ADR-017 as part of the
  remote-push north star. No new dependency in this feature.
- No entity/action filter UI in the MVP screen (the endpoint supports `entity=`/`action=` equality
  filters; the API layer passes them through, so chips are a cheap follow-up).
- Tapping an event deep-links to the affected record via `entity_id` (a `404` there renders as the
  target screen's normal error state — "gone, as usual").

## User Story

As a team member (or solo user)
I want to see a chronological feed of what happened in my active context, with an unread indicator
So that I know what my teammates (or my past self) did without any push infrastructure.

## Problem Statement

Team contexts are multi-user, but the app gives no visibility into other members' actions — you only
notice a teammate's expense when a balance number silently changes. There is no notification
mechanism at all, and remote push is blocked on a paid Apple Developer account.

## Solution Statement

Consume the backend's append-only `/events` ledger through the existing RTK Query + `withTeam`
pattern; render a feed screen pushed from the Dashboard (new `dashboard/` stack, mirroring
`transactions/`); persist a per-context `lastSeen` event id in a new tiny `activity` slice; compute
the unread count with `GET /events?since_id=<lastSeen>` in a `useUnreadActivity` hook that renders
as a badge on the Dashboard's bell icon. Marking seen = opening the feed. Everything builds on
seams that already exist; nothing is thrown away when remote push lands (backend ADR-009 north star).

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: RTK Query api layer, redux store (new slice + persist whitelist),
Dashboard screen/route structure, i18n, docs (ADR-017)
**Dependencies**: none new (pure JS + existing Expo SDK modules — Expo Go safe)

**⚠️ Backend status**: `GET /events` is a **planned contract — NOT shipped yet**
(`/Users/jayro/Dev/Node/Projects/balance/docs/react-native-activity-feed-update.md`, backend plan
`balance/.claude/agents/plans/activity-events-ledger.md`). Build against the contract; all automated
tests here are fetch-mocked so implementation does not block on it. **Before manual validation**,
check the contract doc's status line — the backend flips it to "work done" (and notes deviations)
when it ships.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `/Users/jayro/Dev/Node/Projects/balance/docs/react-native-activity-feed-update.md` — THE contract:
  params, response shape, event catalog, suggested behavior. Re-read for the catalog table (§2).
- `src/services/api/transactions.js` (lines 12–26) — Why: `getTransactions` is the exact pattern for
  `getEvents` (filter serialization via `URLSearchParams`, `withTeam` wrapping, tag shape).
- `src/services/api/teamParam.js` — Why: `withTeam(path, team_id)` — the ONE place `?team_id=` is built.
- `src/services/api/baseApi.js` (line 42) — Why: `tagTypes` array to extend with `'Event'`.
- `src/services/api/index.js` — Why: barrel that must re-export `./events` (side-effect registration).
- `src/reducers/context/index.js` — Why: template for the new `activity` slice (shape, comment style,
  persisted + reset-on-logout semantics).
- `src/reducers/context/index.test.js` — Why: reducer test pattern to mirror.
- `src/store/index.js` (lines 20–34) — Why: where the new reducer + persist `whitelist` entry go.
- `src/screens/Settings/index.jsx` (lines 49–59) — Why: `onLogout` dispatches `resetContext()`;
  `resetActivity()` goes right next to it.
- `src/screens/Transactions/ListScreen.jsx` — Why: canonical list screen — FlatList + Card rows,
  `QueryBoundary`, pull-to-refresh `refreshing` local-state pattern (lines 71–81), `ScreenHeader`
  `right` slot with an icon `Pressable` (lines 108–116), `makeStyles(colors)` factory.
- `src/screens/Dashboard/index.jsx` — Why: gets the bell + badge in its `ScreenHeader`; also the
  context-switch chips (the feed is per-context via the same `useActiveTeamId()`).
- `app/(tabs)/transactions/_layout.jsx` — Why: the Stack layout to mirror for the new `dashboard/` folder.
- `app/(tabs)/dashboard.jsx` — Why: the 1-line shim being replaced by a folder.
- `app/(tabs)/_layout.jsx` (line 44) — Why: `Tabs.Screen name="dashboard"` — stays unchanged when the
  file becomes a folder.
- `src/components/ui/ScreenHeader.jsx` — Why: `back` + `right` props for the feed screen header.
- `src/components/ui/QueryBoundary.jsx` — Why: exact props (`isLoading, error, isEmpty, emptyText, onRetry`).
- `src/hooks/useActiveTeamId.js` + `src/hooks/useIdToken.js` — Why: thin-selector hook style; the feed
  needs both (context + `myUserId` for "You" rendering).
- `src/utils/jwt.js` — Why: `decodeUser(token)` → `{ id }` = `myUserId` (same source as `src/permissions`).
- `src/utils/money.js` — Why: `formatMoney(amount, currency)` for `summary.amount` rendering.
- `src/utils/dates.js` — Why: luxon helpers; `timeAgo` gets added here next to `formatDateTime`.
- `src/services/api/endpoints.test.js` (lines 1–73) — Why: endpoint URL-building test pattern
  (store factory, fetch mock, autoBatch gotcha) — the events block mirrors the transactions block.
- `src/screens/Transactions/ListScreen.test.jsx` — Why: the screen-test pattern (what gets mocked,
  `renderWithStore`) for the Activity screen test.
- `src/test-utils/renderWithStore.jsx` — Why: screen-test harness.
- `src/i18n/locales/en-US.json` + `es-MX.json` — Why: locale structure; every new key lands in BOTH.

### New Files to Create

- `src/services/api/events.js` — `getEvents` query (RTK Query `injectEndpoints`)
- `src/reducers/activity/index.js` — `lastSeen` per-context slice + `contextKey` helper
- `src/reducers/activity/index.test.js` — slice tests
- `src/hooks/useUnreadActivity.js` — unread count for the active context
- `src/utils/activity.js` — `eventMessage(event, opts)` + `eventHref(event)` (catalog → i18n / deep link)
- `src/utils/activity.test.js` — catalog mapping + generic-fallback tests
- `src/screens/Activity/index.jsx` — the feed screen
- `src/screens/Activity/index.test.jsx` — screen behavior test
- `app/(tabs)/dashboard/_layout.jsx` — Stack (mirrors transactions layout)
- `app/(tabs)/dashboard/index.jsx` — 1-line shim → `src/screens/Dashboard`
- `app/(tabs)/dashboard/activity.jsx` — 1-line shim → `src/screens/Activity`
- `.claude/ADR/ADR-017-activity-feed.md` — decision record (feed-as-notification-surface; push north star)

### Files to Delete

- `app/(tabs)/dashboard.jsx` — replaced by the `dashboard/` folder (same route name).

### Relevant Documentation

- Contract: `/Users/jayro/Dev/Node/Projects/balance/docs/react-native-activity-feed-update.md`
  - §1 params + response, §2 event catalog, §3 suggested client behavior, §4 non-goals.
- [RTK Query — providesTags](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching#providing-tags)
  - Why: `getEvents` provides `Event` but nothing invalidates it — freshness comes from the app-wide
    `refetchOnMountOrArgChange: true` (`baseApi.js:45`) + pull-to-refresh. Do NOT add `'Event'` to
    every mutation's `invalidatesTags`.
- [expo-router — nested Stack in Tabs](https://docs.expo.dev/router/advanced/nesting-navigators/)
  - Why: `dashboard.jsx` → `dashboard/{_layout,index,activity}.jsx` keeps the tab intact; already
    proven by `transactions/` and `vaults/`.
- [luxon — toRelative](https://moment.github.io/luxon/api-docs/index.html#datetimetorelative)
  - Why: `timeAgo` feed timestamps ("3 hours ago"), locale-aware.

### Patterns to Follow

**Filter serialization + team param** (`src/services/api/transactions.js:14-21`):
```js
query: ({ team_id, ...filters } = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const qs = params.toString();
  return withTeam(`/events${qs ? `?${qs}` : ''}`, team_id);
},
```

**Slice comment + shape** (`src/reducers/context/index.js`) — top-of-file comment states persistence
and logout semantics + the ADR number.

**Pull-to-refresh** (`ListScreen.jsx:71-81`) — local `refreshing` state driven only by the user pull,
never by auto refetch (iOS stuck-spinner gotcha).

**Styles**: `const styles = makeStyles(colors)` factories; NEVER import a static color; text on
accent = `colors.primaryText` (ADR-013). No `StyleSheet.absoluteFill` (removed in RN 0.85 — write
explicit `position:'absolute'` + edges if needed).

**Screens**: render `ScreenHeader` (native headers hidden app-wide); pushed screens pass `back`.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (data + state)
API endpoint, tag type, `activity` slice + persistence + logout reset.

### Phase 2: Core (rendering + unread logic)
`eventMessage`/`eventHref` catalog util, `timeAgo`, i18n strings, `useUnreadActivity`.

### Phase 3: Integration (screens + routes)
Activity screen, `dashboard/` stack conversion, bell + badge on Dashboard.

### Phase 4: Testing & docs
Endpoint/slice/util/screen tests, ADR-017, ARCHITECTURE.md + CLAUDE.md sync.

---

## STEP-BY-STEP TASKS

### 1. UPDATE `src/services/api/baseApi.js`

- **IMPLEMENT**: add `'Event'` to the `tagTypes` array (line 42).
- **VALIDATE**: `npm test -- src/services/api/baseApi.test.js`

### 2. CREATE `src/services/api/events.js`

- **IMPLEMENT**:
  ```js
  import { baseApi } from './baseApi';
  import { withTeam } from './teamParam';

  // /events — read-only, append-only activity feed, newest first. Context-scoped like /transactions:
  // optional team_id → URL `?team_id=` (never a body) and part of the cache key. No write routes and
  // nothing invalidates 'Event': freshness = refetchOnMountOrArgChange + pull-to-refresh (ADR-017).
  // Contract: balance/docs/react-native-activity-feed-update.md.
  const LIST_TAG = { type: 'Event', id: 'LIST' };

  export const eventsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
      getEvents: build.query({
        // arg: { team_id?, entity?, action?, since_id?, limit? }
        query: ({ team_id, ...filters } = {}) => { /* transactions.js pattern above */ },
        providesTags: [LIST_TAG],
      }),
    }),
  });

  export const { useGetEventsQuery } = eventsApi;
  ```
- **PATTERN**: `src/services/api/transactions.js:12-26`
- **GOTCHA**: `since_id`/`limit` must be **positive** integers server-side — never append `0`
  (the `v !== ''` guard does NOT drop `0`; callers pass `undefined` instead, see Task 7).
- **VALIDATE**: `npm test -- src/services/api/endpoints.test.js` (fully validated by Task 12)

### 3. UPDATE `src/services/api/index.js`

- **IMPLEMENT**: add `export * from './events';` after the `shoppingLists` line.
- **VALIDATE**: `npm test -- src/services/api`

### 4. CREATE `src/reducers/activity/index.js`

- **IMPLEMENT**:
  ```js
  import { createSlice } from '@reduxjs/toolkit';

  // Last-seen event id per context — drives the unread badge (ADR-017). Keyed 'personal' | String(teamId)
  // because object keys stringify anyway. Persisted (non-secret), reset on logout like context (ADR-011).
  export const contextKey = (teamId) => (teamId == null ? 'personal' : String(teamId));

  const initialState = { lastSeen: {} };

  const activitySlice = createSlice({
    name: 'activity',
    initialState,
    reducers: {
      markSeen: (state, action) => {
        const { key, id } = action.payload;
        const current = state.lastSeen[key];
        if (current == null || id > current) state.lastSeen[key] = id; // only ever advances
      },
      resetActivity: () => initialState,
    },
  });

  export const { markSeen, resetActivity } = activitySlice.actions;
  export const selectLastSeen = (state, teamId) => state.activity.lastSeen[contextKey(teamId)] ?? null;
  export default activitySlice.reducer;
  ```
- **PATTERN**: `src/reducers/context/index.js` (comment style, action/selector exports)
- **GOTCHA**: `markSeen` never lowers the id — a stale refetch racing a newer one must not regress
  the badge. `id: 0` is a valid seed (empty feed visited) so the badge activates from then on.
- **VALIDATE**: `npm test -- src/reducers/activity` (test written in Task 13)

### 5. UPDATE `src/store/index.js`

- **IMPLEMENT**: import `activityReducer from '../reducers/activity'`; add `activity: activityReducer`
  to `combineReducers`; add `'activity'` to the persist `whitelist` (line 33).
- **GOTCHA**: no redux-persist migration needed — a key absent from persisted state falls back to the
  reducer's initial state.
- **VALIDATE**: `npm test`

### 6. UPDATE `src/screens/Settings/index.jsx`

- **IMPLEMENT**: in `onLogout` (line 49), `dispatch(resetActivity())` right after
  `dispatch(resetContext())`; import from `../../reducers/activity`.
- **GOTCHA**: mirror ONLY the logout path — the 401 path in `baseApi.js` doesn't reset `context`
  either; stay consistent (stale ids are harmless, they're advanced on next feed open).
- **VALIDATE**: `npm test`

### 7. CREATE `src/hooks/useUnreadActivity.js`

- **IMPLEMENT**:
  ```js
  import { useSelector } from 'react-redux';
  import { useGetEventsQuery } from '../services/api/events';
  import { selectLastSeen } from '../reducers/activity';
  import { useActiveTeamId } from './useActiveTeamId';

  // Unread events in the active context = events newer than the persisted last-seen id (ADR-017).
  // No lastSeen yet (context never opened the feed) → skip the fetch, show no badge; the first feed
  // open seeds it. lastSeen 0 (seeded on an empty feed) → omit since_id (must be positive) = all events.
  export const useUnreadActivity = () => {
    const teamId = useActiveTeamId();
    const lastSeen = useSelector((s) => selectLastSeen(s, teamId));
    const { data } = useGetEventsQuery(
      { team_id: teamId, since_id: lastSeen > 0 ? lastSeen : undefined, limit: 200 },
      { skip: lastSeen == null },
    );
    return lastSeen == null ? 0 : (data?.length ?? 0);
  };
  ```
- **PATTERN**: `src/hooks/useActiveTeamId.js` (thin hook style)
- **GOTCHA**: the app-wide `refetchOnMountOrArgChange: true` makes this refresh whenever the
  Dashboard (re)mounts and whenever `lastSeen`/`teamId` changes the arg — no polling code needed.
  Opening the feed advances `lastSeen` → new arg → refetch → count drops to 0.
- **VALIDATE**: `npm test`

### 8. UPDATE `src/utils/dates.js` — ADD `timeAgo`

- **IMPLEMENT**:
  ```js
  // Relative feed timestamps ("3 hours ago"), locale-aware; created_at is ISO-8601 UTC (ADR-017).
  export const timeAgo = (iso, locale) =>
    iso ? DateTime.fromISO(iso, { zone: 'utc' }).toRelative({ locale }) : '';
  ```
- **PATTERN**: `formatDateTime` one line above (same UTC-zone parse)
- **VALIDATE**: `npm test -- src/utils/dates.test.js` (add a case in Task 13)

### 9. CREATE `src/utils/activity.js` + UPDATE both locale files

- **IMPLEMENT** `eventMessage(event, { t, actor, currency })` → display string, and
  `eventHref(event)` → expo-router href or `null`. Pure functions, no hooks.
  ```js
  import { formatMoney } from './money';

  // Event catalog → i18n message (contract §2). Unknown entity/action MUST fall back to the generic
  // line so future event types never crash the feed. Amounts in `summary` are decimals, as everywhere.
  export const eventMessage = (event, { t, actor, currency }) => {
    const { entity, action, summary = {} } = event;
    const amount = summary.amount != null ? formatMoney(summary.amount, currency) : undefined;
    const key = `${entity}_${action}`;
    switch (key) {
      case 'transaction_created':
      case 'transaction_updated':
      case 'transaction_deleted':
        return t(`activity.${key}`, {
          actor, amount,
          what: summary.description || t(`transactions.${summary.type}`, { defaultValue: summary.type }),
        });
      case 'vault_created':
      case 'vault_deleted':
      case 'shopping_list_created':
      case 'shopping_list_deleted':
        return t(`activity.${key}`, { actor, name: summary.name });
      case 'vault_allocated':
      case 'vault_withdrawn':
      case 'shopping_list_checked_out':
        return t(`activity.${key}`, { actor, name: summary.name, amount });
      case 'shopping_list_item_created':
      case 'shopping_list_item_deleted':
        return t(`activity.${key}`, { actor, name: summary.name });
      case 'shopping_list_item_updated':
        return summary.checked
          ? t('activity.shopping_list_item_checked', { actor, name: summary.name })
          : t('activity.shopping_list_item_updated', { actor, name: summary.name });
      case 'team_updated':
        return summary.name
          ? t('activity.team_renamed', { actor, name: summary.name })
          : t('activity.team_updated', { actor });
      case 'team_member_added':
      case 'team_role_changed':
        return t(`activity.${key}`, {
          actor, role: t(`teams.role_${summary.role}`, { defaultValue: summary.role }),
        });
      case 'team_member_removed':
        return t('activity.team_member_removed', { actor });
      default:
        return t('activity.generic', { actor, entity, action });
    }
  };

  // Deep link to the affected record (contract: entity_id). Deleted/unknown → null (no navigation);
  // a 404 on an edited-away record is handled by the target screen, as usual.
  export const eventHref = ({ entity, action, entity_id, summary = {} }) => {
    if (action === 'deleted') return null;
    switch (entity) {
      case 'transaction': return `/(tabs)/transactions/${entity_id}`;
      case 'vault': return `/(tabs)/vaults/${entity_id}`;
      case 'shopping_list': return `/(tabs)/transactions/lists/${entity_id}`;
      case 'shopping_list_item':
        return summary.list_id ? `/(tabs)/transactions/lists/${summary.list_id}` : null;
      case 'team': return `/(tabs)/teams/${entity_id}`;
      default: return null;
    }
  };
  ```
- **IMPLEMENT** — `src/i18n/locales/en-US.json`, new `"activity"` section (and the es-MX mirror):
  ```json
  "activity": {
    "title": "Activity",
    "empty": "Nothing yet — actions in this context will show up here.",
    "you": "You",
    "generic": "{{actor}} · {{entity}} {{action}}",
    "transaction_created": "{{actor}} added {{what}} — {{amount}}",
    "transaction_updated": "{{actor}} updated {{what}} — {{amount}}",
    "transaction_deleted": "{{actor}} deleted {{what}} — {{amount}}",
    "vault_created": "{{actor}} created vault {{name}}",
    "vault_deleted": "{{actor}} deleted vault {{name}}",
    "vault_allocated": "{{actor}} moved {{amount}} into {{name}}",
    "vault_withdrawn": "{{actor}} took {{amount}} out of {{name}}",
    "shopping_list_created": "{{actor}} started list {{name}}",
    "shopping_list_deleted": "{{actor}} deleted list {{name}}",
    "shopping_list_checked_out": "{{actor}} checked out {{name}} — {{amount}}",
    "shopping_list_item_created": "{{actor}} added {{name}}",
    "shopping_list_item_updated": "{{actor}} updated {{name}}",
    "shopping_list_item_checked": "{{actor}} checked off {{name}}",
    "shopping_list_item_deleted": "{{actor}} removed {{name}}",
    "team_renamed": "{{actor}} renamed the team to {{name}}",
    "team_updated": "{{actor}} updated the team",
    "team_member_added": "{{actor}} added a member as {{role}}",
    "team_role_changed": "{{actor}} changed a member's role to {{role}}",
    "team_member_removed": "{{actor}} removed a member"
  }
  ```
  es-MX: translate all values (e.g. `"transaction_created": "{{actor}} agregó {{what}} — {{amount}}"`,
  `"you": "Tú"`, `"vault_allocated": "{{actor}} movió {{amount}} a {{name}}"`, etc.).
- **GOTCHA**: i18next interpolation is `{{var}}`; every key must exist in BOTH locales
  (`changeLanguage` is user-facing). `t(..., { defaultValue })` guards unknown `type`/`role` values.
- **VALIDATE**: `npm test -- src/utils/activity.test.js` (test written in Task 13)

### 10. CREATE `src/screens/Activity/index.jsx` + route conversion

- **IMPLEMENT** — screen (composition mirrors `Transactions/ListScreen.jsx`, simpler):
  - Hooks: `useTranslation`, `useDispatch`, `useRouter`, `useTheme`, `useActiveTeamId`,
    `useIdToken` + `decodeUser` → `myUserId`, `useSelector((s) => selectLastSeen(s, teamId))`,
    `useGetEventsQuery({ team_id: teamId })`, `useGetBalanceQuery(teamId)` → `currency`.
  - Mark-seen effect:
    ```js
    useEffect(() => {
      if (!data) return;
      const top = data[0]?.id ?? 0; // newest first; empty feed seeds 0 so the badge activates
      if (lastSeen == null || top > lastSeen) dispatch(markSeen({ key: contextKey(teamId), id: top }));
    }, [data, lastSeen, teamId, dispatch]);
    ```
  - `<Screen padded={false}>` + `<ScreenHeader title={t('activity.title')} back style={styles.headerPad} />`.
  - `FlatList` of `Card` rows inside `QueryBoundary`
    (`isEmpty={!!data && data.length === 0}`, `emptyText={t('activity.empty')}`); pull-to-refresh
    with the local `refreshing` pattern (`ListScreen.jsx:71-81`).
  - Row: actor = `item.user_id === myUserId ? t('activity.you') : item.actor_email`;
    text = `eventMessage(item, { t, actor, currency })`; meta = `timeAgo(item.created_at, i18n.language)`;
    left icon per entity (Ionicons: transaction `swap-horizontal-outline`, vault `wallet-outline`,
    shopping_list/shopping_list_item `cart-outline`, team `people-outline`, default `ellipse-outline`);
    `href = eventHref(item)` → wrap in `Pressable` with `onPress={() => router.push(href)}` only when
    non-null.
  - `keyExtractor={(item) => String(item.id)}`; styles via `makeStyles(colors)`.
- **IMPLEMENT** — routes:
  - DELETE `app/(tabs)/dashboard.jsx`.
  - CREATE `app/(tabs)/dashboard/_layout.jsx` — MIRROR `app/(tabs)/transactions/_layout.jsx`
    (Stack, `headerShown: false`, themed `contentStyle`) with `<Stack.Screen name="index" />` and
    `<Stack.Screen name="activity" />`. Import path depth: `'../../../src/hooks/useTheme'`.
  - CREATE `app/(tabs)/dashboard/index.jsx` — `export { default } from '../../../src/screens/Dashboard';`
  - CREATE `app/(tabs)/dashboard/activity.jsx` — `export { default } from '../../../src/screens/Activity';`
- **GOTCHA**: the tab registration (`app/(tabs)/_layout.jsx:44`, `name="dashboard"`) is unchanged — a
  folder with an `index` is the same route as the file it replaces. Shim import paths gain one `../`.
- **GOTCHA**: deep links cross tab stacks (feed lives under `dashboard/`, targets under
  `transactions/` etc.) — absolute `/(tabs)/...` hrefs with `router.push` handle that (the ListScreen
  header already pushes `/(tabs)/transactions/lists` the same way).
- **VALIDATE**: `npm test -- src/screens/Activity` (test in Task 13), then manual (Level 4).

### 11. UPDATE `src/screens/Dashboard/index.jsx` — bell + badge

- **IMPLEMENT**: `ScreenHeader` gets a `right` slot (pattern `ListScreen.jsx:111-115`):
  ```jsx
  const unread = useUnreadActivity();
  // ...
  <ScreenHeader
    title={t('dashboard.title')}
    right={
      <Pressable hitSlop={10} testID="activity-link" onPress={() => router.push('/(tabs)/dashboard/activity')}>
        <Ionicons name="notifications-outline" size={24} color={colors.primary} />
        {unread > 0 ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
        ) : null}
      </Pressable>
    }
  />
  ```
  Badge styles in `makeStyles`: absolutely positioned bubble on the bell —
  `badge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8,
  backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }`,
  `badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' }`.
  New imports: `Pressable`, `Ionicons`, `useRouter`, `useUnreadActivity`.
- **GOTCHA**: badge text on `colors.danger` is the one place plain white is fine (danger is static in
  both palettes, not the team accent — same as elsewhere; do NOT use `primaryText` here, that tracks
  the accent). No `StyleSheet.absoluteFill` (RN 0.85).
- **VALIDATE**: `npm test`, then manual (Level 4).

### 12. UPDATE `src/services/api/endpoints.test.js` — events block

- **IMPLEMENT**: new `describe('events feed — URL building (ADR-017)')` mirroring the transactions
  block: import `eventsApi` from `./events`;
  - bare call `initiate({})` → URL matches `/\/events$/`;
  - `initiate({ team_id: 5, since_id: 42, limit: 200 })` → contains `since_id=42`, `limit=200`,
    `team_id=5`;
  - `initiate({ entity: 'transaction', action: 'created' })` → contains both equality filters;
  - `initiate({ team_id: null })` → no `team_id` in URL.
- **PATTERN**: `endpoints.test.js:51-73` + the store factory at the top of the file.
- **VALIDATE**: `npm test -- src/services/api/endpoints.test.js`

### 13. CREATE remaining tests

- **IMPLEMENT** `src/reducers/activity/index.test.js` (MIRROR `context/index.test.js`):
  - initial state `{ lastSeen: {} }`; `markSeen` sets a new key; advances a higher id; **ignores a
    lower id**; accepts `id: 0` seed; `resetActivity` clears; `contextKey(null)==='personal'`,
    `contextKey(7)==='7'`; `selectLastSeen` reads by teamId and returns `null` when unset.
- **IMPLEMENT** `src/utils/activity.test.js`:
  - `eventMessage`: stub `t = (key, vals) => [key, JSON.stringify(vals)].join(' ')` (or assert on
    key + interpolation values) — transaction created uses description, falls back to type label;
    vault allocated includes formatted amount; item `updated` with `checked: true` → the `_checked`
    key; **unknown entity/action → `activity.generic`** (the contract's crash-guard requirement).
  - `eventHref`: each entity maps to its route; `deleted` → null; item uses `summary.list_id`;
    unknown entity → null.
- **IMPLEMENT** `src/utils/dates.test.js` — ADD a `timeAgo` case (returns a non-empty string for a
  recent ISO timestamp; `''` for null).
- **IMPLEMENT** `src/screens/Activity/index.test.jsx` (MIRROR `Transactions/ListScreen.test.jsx`
  mocking approach + `renderWithStore`):
  - mock `useGetEventsQuery` to return two catalog events (one own, one other actor) → both rows
    render, own row shows the "You" label;
  - after render, the store's `activity.lastSeen` for the context equals the top event id (mark-seen);
  - empty data → `activity.empty` text renders.
- **VALIDATE**: `npm test`

### 14. CREATE `.claude/ADR/ADR-017-activity-feed.md` + docs sync

- **IMPLEMENT**: ADR-017 (copy `ADR-000-template.md`): context (multi-user teams, no visibility, push
  blocked on paid Apple account), decision (poll `GET /events` as THE notification surface; per-context
  persisted `lastSeen` → `since_id` unread badge; feed screen under the dashboard stack; **north star:
  Expo Push delivering the same events — backend ADR-009; local notifications deliberately deferred**,
  they'd fire while the user is already in-app), consequences, alternatives (expo-notifications now,
  websockets, per-event read receipts — all rejected/deferred). Add the row to `.claude/ADR/README.md`
  index.
- **IMPLEMENT**: `ARCHITECTURE.md` — add Activity to the §1 nav graph (dashboard stack: `index` +
  `activity`), add `events.js (Event)` to the §2 endpoint list, add `activity` to the §4 reducers line
  and the file map. `CLAUDE.md` — key-files rows for `src/services/api/events.js`,
  `src/reducers/activity/`, `src/hooks/useUnreadActivity.js`, `src/screens/Activity/`, and a
  Conventions bullet (feed is read-only; nothing invalidates `Event`; `since_id` must be positive).
- **GOTCHA**: `.claude/` is **gitignored** — `git add -f .claude/ADR/ADR-017-activity-feed.md
  .claude/agents/plans/006-activity-feed.md` at commit time or they vanish.
- **VALIDATE**: `git status --short` shows the force-added files staged.

---

## TESTING STRATEGY

### Unit Tests
- Slice: `src/reducers/activity/index.test.js` — monotonic `markSeen`, reset, key mapping, selector.
- Utils: `src/utils/activity.test.js` — full catalog table + generic fallback + href map;
  `dates.test.js` — `timeAgo`.
- Endpoints: `endpoints.test.js` — URL building incl. `?team_id=` isolation (fetch-mocked; no backend).

### Integration Tests
- `src/screens/Activity/index.test.jsx` — rows render from mocked query data, "You" substitution,
  mark-seen store effect, empty state. (Behavior, not design — per project testing memory.)

### Edge Cases
- Unknown `entity`/`action` → generic line, no crash (contract §2 requirement).
- Empty feed first open → seeds `lastSeen: 0`; badge query then omits `since_id` (positive-int rule).
- Refetch returning stale/fewer events never regresses `lastSeen`.
- `summary.description` null → type label fallback; `summary.amount` absent → no formatted amount.
- Deleted-record deep link: `action: 'deleted'` rows don't navigate; edited-away targets 404 on their
  own screen (existing behavior).
- Context switch: personal and each team keep isolated caches (arg includes `team_id`) and isolated
  `lastSeen` keys.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
No linter is configured; correctness is carried by the test suite.
```bash
npx expo-doctor          # health check — confirms no dependency drift (nothing new was added)
```

### Level 2: Unit Tests
```bash
npm test -- src/reducers/activity src/utils/activity.test.js src/utils/dates.test.js
npm test -- src/services/api/endpoints.test.js
```

### Level 3: Integration Tests
```bash
npm test                 # full suite — zero regressions
```

### Level 4: Manual Validation
**Precondition**: backend `/events` shipped — check the status line at the top of
`/Users/jayro/Dev/Node/Projects/balance/docs/react-native-activity-feed-update.md` (and any noted
deviations) before this level.
```bash
cd ../../Node/Projects/balance && NODE_ENV=stage npm start   # backend
APP_ENV=dev npx expo start                                   # app (API_URL → backend)
```
- Dashboard shows the bell; create a transaction from a second account in a shared team → badge count
  appears on next Dashboard focus (in the team context).
- Open the feed → rows render newest-first with actor/relative-time; badge clears on return.
- Own actions show "You"; other members show their email.
- Tap a transaction event → its edit screen; tap a checked-out list event → the list detail.
- Switch Personal ↔ team → feed + badge are per-context.
- Pull-to-refresh works; kill + relaunch the app → `lastSeen` survived (badge doesn't reappear).
- Switch language to es-MX → feed lines translate.

---

## ACCEPTANCE CRITERIA

- [ ] `GET /events` consumed via RTK Query with `team_id` in the URL only, per-context cache keys
- [ ] Feed screen under the dashboard stack: newest-first, pull-to-refresh, empty/error/loading via
      `QueryBoundary`, back chevron, themed via `useTheme`
- [ ] Full contract §2 catalog rendered; unknown event types render the generic line (no crash)
- [ ] Unread badge on the Dashboard bell, driven by persisted per-context `lastSeen` + `since_id`;
      opening the feed marks seen; survives app restart; reset on logout
- [ ] Deep links to transaction / vault / list / team records; deleted events don't navigate
- [ ] All strings in en-US **and** es-MX
- [ ] No new native dependency (Expo Go safe); local notifications deferred + recorded in ADR-017
- [ ] `npm test` fully green; new unit + screen tests in place
- [ ] ADR-017 written + index row; ARCHITECTURE.md + CLAUDE.md synced; `.claude/` files force-added

## COMPLETION CHECKLIST

- [ ] All tasks completed in order, each task's validation run immediately
- [ ] Full suite passes; no regressions
- [ ] Manual Level 4 done (or explicitly deferred if the backend hasn't shipped — note it in the
      commit/PR body)
- [ ] Conventional commit, e.g. `feat: activity feed — per-context /events screen + unread badge`
- [ ] Plan + ADR force-added to git

## NOTES

- **Why no `invalidatesTags: ['Event']` on mutations**: the feed must show OTHER members' actions,
  which no local mutation knows about — invalidation can't provide freshness here, polling can. The
  app-wide `refetchOnMountOrArgChange: true` already refetches on every screen mount/focus-remount,
  matching the contract's "on-focus + manual refresh is enough for the MVP".
- **Why a new slice instead of `prefs`**: `prefs` is device-level and deliberately NOT reset on
  logout (ADR-013); `lastSeen` is account/context data and must reset like `context` (ADR-011).
- **Why the bell lives on the Dashboard** (not a tab): the tab bar is at 6 items; the doc suggests
  "reachable from the dashboard"; the header `right` slot is the established pattern
  (Transactions → shopping lists).
- **Badge count semantics**: capped visually at `99+`; the underlying query caps at `limit: 200`
  (server max) — good enough for an MVP badge.
- **Filters follow-up**: `entity=`/`action=` are already threaded through `getEvents`; adding filter
  chips later is a screen-only change.
- **North star** (ADR-017): Expo Push delivers these same events when the app is closed (backend
  ADR-009) — client work then = push-token registration + notification handlers; this feed stays as-is.
