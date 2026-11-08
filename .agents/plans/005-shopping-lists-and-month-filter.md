# Feature: Shopping lists (pre-expense checklists) + month/year filter on transactions

The following plan should be complete, but it's important that you validate documentation and
codebase patterns and task sanity before you start implementing. Pay special attention to naming of
existing utils, components, and API files — import from the right barrels (`src/components/ui`) and
mirror the exact RTK Query conventions.

## Feature Description

**Part 1 — Shopping lists.** A supermarket-style checklist that lives *before* the ledger: the user
creates a named list ("Supermarket"), adds items, checks them off while shopping, and finally
**checks out** — one action that records a real `expense` transaction whose description is the list
name, and freezes the list as `purchased`. The transaction is created **server-side** in the
checkout endpoint (atomic: post + link + status flip), following the same philosophy as capture
confirm and transfers (ADR-014): money-writing invariants live in the backend.

**Part 2 — Month filter.** The Transactions history gains a month + year filter ("All" or a specific
month of a specific year), composing with the existing type chips. Filtering is **client-side**
(string-prefix match on `occurred_at`, which is `YYYY-MM-DD`) because the list is already fully
fetched with no pagination; a server-side `?from=&to=` param is noted as a north star in the BE
request doc but not required.

## User Story

As a `balance` user doing groceries
I want to build a checklist beforehand, tick items off in the store, and hit "checkout" at the till
So that the expense lands in my ledger (in the right personal/team context) without retyping
anything — and later I can filter my history down to any month to review spending.

## Problem Statement

- Planned spending has no home: users track shopping lists in another app, then manually re-enter
  the total as a transaction. The link between "what I planned to buy" and "what I spent" is lost.
- The transactions history is one long list; there is no way to review a specific month.

## Solution Statement

- New backend entities `shopping_lists` + `shopping_list_items` (context-scoped via `?team_id=`,
  standard restGenerator CRUD) plus one custom action `POST /shopping-lists/:id/checkout` that posts
  the expense transaction server-side. Client: one RTK Query file, two screens under the
  transactions stack, entry via a cart icon in the Transactions header.
- Month filter: local UI state on the Transactions list — "All" chip + year stepper + horizontal
  month chips — filtering the already-fetched array by `occurred_at.startsWith('YYYY-MM')`.

## Feature Metadata

**Feature Type**: New Capability (Part 1) + Enhancement (Part 2)
**Estimated Complexity**: Medium-High (new entity pair + cross-repo contract) / Low (filter)
**Primary Systems Affected**: RTK Query layer, transactions tab stack, i18n, backend (via request doc)
**Dependencies**: none new — RTK Query, luxon, expo-router, i18next (all present)

---

## RESOLVED DESIGN DECISIONS (with rationale)

| Question | Decision | Why |
|---|---|---|
| Per-item prices vs single total | **Optional per-item `price`** (estimate); checkout `amount` is **required and editable**, prefilled with the sum of *checked* items' prices | Real tickets never match estimates; per-item prices give a useful running total in-store without forcing data entry. Backend never guesses: the client always sends the final `amount`. |
| Item status model | **Checkbox** (`checked` boolean), not a dropdown | The in-store gesture is binary (got it / not yet). A status enum (`pending/in_cart/unavailable`) is a north-star note in the ADR, not shipped. |
| List lifecycle | **One-shot**: `status: 'open' → 'purchased'` at checkout; purchased lists become read-only history linked to their transaction. Delete allowed anytime (soft-delete; never touches the posted transaction). | Simplest model that closes the loop. Reusable templates / "duplicate list" = deferred (ADR north star). |
| Team scoping | **Context-scoped like transactions/vaults** — `?team_id=` query param, never body; list + checkout post into the list's own context | A household team shares its supermarket list; the posted expense must land in the same context the list lives in. Standard RBAC applies (guest read-only, member own rows, owner all). |
| Where in navigation | **Stack inside the transactions tab** (`app/(tabs)/transactions/lists/`), entered via a cart icon in the Transactions `ScreenHeader` `right` slot | Tab bar already has 6 tabs; lists are "pre-expenses" so they belong with the ledger. Mirrors Dashboard→Transfer header-action pattern. |
| Checkout transaction location | **Server-side** in the checkout endpoint | Atomicity (post + link `transaction_id` + flip status in one write) and one owner for the `available`-can't-go-negative rule. Same reasoning as capture confirm (ADR-014). |
| Month filter | **Client-side** over the fetched array | No pagination exists; `occurred_at` is `YYYY-MM-DD` so prefix match is exact and free. Avoids blocking on a backend change. `?from=&to=` requested as optional north star. |

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING!

- `src/services/api/sources.js` (whole file) — Why: THE pattern for a parent + flat child-resource
  API file (sources + aliases sharing one tag). `shoppingLists.js` mirrors it (lists + items share
  tag `ShoppingList`).
- `src/services/api/transactions.js` (lines 12–26) — Why: filter serialization via `URLSearchParams`
  + `withTeam(...)`; lists reuse this exact `query:` shape since they are context-scoped.
- `src/services/api/captures.js` (whole file) — Why: custom path-action mutation pattern
  (`POST /captures/:id/confirm`) that `checkoutList` mirrors, including multi-tag invalidation.
- `src/services/api/baseApi.js` — Why: `tagTypes` array must gain `'ShoppingList'`.
- `src/services/api/teamParam.js` — Why: `withTeam()` is the only place `?team_id=` is built.
- `src/screens/Sources/EditScreen.jsx` (lines 55–76 create→`router.replace` to edit; lines 151–238
  `AliasesSection`) — Why: the create-then-manage-children flow and the inline child-rows section
  that `DetailScreen`'s items section mirrors.
- `src/screens/Transactions/ListScreen.jsx` (lines 15–26 filter state/chips; 69–99 layout) — Why:
  Part 2 edits this file; also the FlatList + QueryBoundary + FAB pattern for the lists index screen.
- `src/screens/Transactions/TransactionForm.jsx` — Why: amount-input and category-chip conventions
  the checkout form must match (decimal keyboard, positive amount validation at form boundary).
- `src/screens/Inbox/index.test.jsx` — Why: behavioral screen-test pattern (renderWithStore, mocked
  fetch, assert callbacks/contracts — never styles; memory: test behavior, not design).
- `src/test-utils/renderWithStore.jsx` — Why: the screen-test harness.
- `src/services/api/endpoints.test.js` (lines 1–52 harness; 262–300 sources block) — Why: the
  endpoint URL/body/invalidation test pattern to extend for shopping lists.
- `src/utils/dates.js` — Why: luxon helpers live here; add month-name helper for the filter chips.
- `src/i18n/locales/en-US.json` + `es-MX.json` — Why: add `lists.*` keys + new `transactions.*`
  filter keys to BOTH.
- `app/(tabs)/transactions/_layout.jsx` + `app/(tabs)/transactions/new.jsx` — Why: stack layout and
  the 1-line shim pattern for the two new routes.
- `src/permissions/index.js` — Why: `usePermissions()` gates add/checkout/edit affordances
  (`canAdd`, `canEditRow(row)`).
- `docs/backend-auto-capture-request.md` — Why: THE template for the new backend request doc
  (structure: concepts → data → entities/endpoints → invariants → mobile consumption).
- `.claude/ADR/ADR-014-auto-capture-domain-model.md` + `.claude/ADR/ADR-000-template.md` +
  `.claude/ADR/README.md` — Why: ADR style, template, and the index to update.

### New Files to Create

- `docs/backend-shopping-lists-request.md` — backend contract request (entities + checkout + optional date filter)
- `.claude/ADR/ADR-015-shopping-lists-pre-expense.md` — decision record (+ index row in `.claude/ADR/README.md`)
- `src/services/api/shoppingLists.js` — RTK Query endpoints (lists + items + checkout)
- `src/screens/ShoppingLists/ListScreen.jsx` — lists index (open/purchased, create, FAB)
- `src/screens/ShoppingLists/DetailScreen.jsx` — items + checkboxes + checkout flow
- `src/screens/ShoppingLists/DetailScreen.test.jsx` — behavioral test
- `app/(tabs)/transactions/lists/index.jsx` — 1-line shim → `ShoppingLists/ListScreen`
- `app/(tabs)/transactions/lists/[id].jsx` — 1-line shim → `ShoppingLists/DetailScreen`

### Patterns to Follow

**RTK Query child-resource file (from `sources.js`):** one `injectEndpoints` file, parent + children
share ONE tag so any child write refetches the parent screen. Comment header cites the contract doc
+ ADR.

**Context-scoped query (from `transactions.js:14-21`):**
```js
query: ({ team_id, ...filters } = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const qs = params.toString();
  return withTeam(`/shopping-lists${qs ? `?${qs}` : ''}`, team_id);
},
```

**Path-action mutation (from `captures.js` confirm):** id in the path, overrides in the body,
`invalidatesTags: [...]` spanning entities.

**Screens:** `useTheme()` + `const styles = makeStyles(colors)` factory; every screen renders
`ScreenHeader` (`back` on pushed screens, `right` slot for actions); `QueryBoundary` wraps lists;
errors surface via `Alert.alert(t('common.error'), e?.message ?? '')`; form-boundary validation only.

**Anti-patterns to avoid:** no `fetch` in components; no token/team reads outside the seams; no
static color imports; no `team_id` in any request body (checkout carries NO team fields — the list's
context is resolved server-side from the `?team_id=` param, standard pattern); never edit
`transfer_group_id`/`capture_id` conventions.

---

## PROPOSED BACKEND CONTRACT (content for `docs/backend-shopping-lists-request.md`)

Follow `docs/backend-auto-capture-request.md`'s structure. Summary of what to request:

### Data (house `schema.sql` style; money as cents via `moneyFields`; soft-delete)

```sql
CREATE TABLE shopping_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id),          -- NULL = personal (standard context scoping)
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',           -- 'open' | 'purchased'
  category_id INTEGER REFERENCES categories(id), -- default category for checkout (nullable)
  transaction_id INTEGER REFERENCES transactions(id),  -- set by checkout
  created_at TEXT ..., updated_at TEXT ..., deleted_at TEXT
);

CREATE TABLE shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  list_id INTEGER NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  price INTEGER,                                 -- cents (moneyFields), optional estimate PER UNIT
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT ..., updated_at TEXT ..., deleted_at TEXT
);
```

### Endpoints

| Endpoint | Notes |
|---|---|
| CRUD `/shopping-lists` | restGenerator, context-scoped via `?team_id=` exactly like `/transactions`; `filterFields` at least `status`. |
| CRUD `/shopping-list-items` | restGenerator, flat like `/source-aliases`; list via `?list_id=`; context checked through the parent list. Soft-deleting a list soft-deletes its items. |
| `POST /shopping-lists/:id/checkout` | Custom route BEFORE restGenerator. Body `{ amount, category_id?, occurred_at? }` (decimal, positive). Atomically: create `expense` transaction in the **list's** context with `description = list.name` (fallback `category_id` = list's, `occurred_at` = today), set `transaction_id`, flip `status → 'purchased'`. Returns `200` with the updated list (including `transaction_id`). |

### Invariants (hooks, per house convention)

- `status` ∈ `open | purchased`; checkout only for `open` lists → else `400`; idempotent-safe: a
  second checkout of a purchased list `400`s.
- Item writes and list edits only while `open` → else `400` (purchased lists are frozen history).
- Checkout amount must be `> 0`; the ledger's `available`-can't-go-negative rule applies to the
  posted transaction (a violating checkout `400`s and posts nothing).
- Deleting a purchased list never touches its transaction.
- Standard RBAC: guest read-only; member may edit/checkout own lists; owner all.
- **Optional north star (not required for the client to ship):** `?from=&to=` (`occurred_at` range)
  filter on `GET /transactions` for when pagination arrives.

---

## IMPLEMENTATION PLAN

### Phase 0: Contract + decision docs (no code)
Write the BE request doc and ADR-015 first — they are deliverables the user explicitly asked for,
and the backend agent works from the request doc in the other repo.

### Phase 1: Data layer (works against mocks, no backend needed)
`shoppingLists.js` endpoints + `baseApi` tag + endpoint tests.

### Phase 2: Screens + routes
ListScreen, DetailScreen (items + checkout), route shims, header entry point, i18n keys.

### Phase 3: Month/year filter (independent of Part 1 — can be done first if backend is not ready)
Transactions ListScreen filter UI + `dates.js` helper + tests.

### Phase 4: Docs sync + validation
ARCHITECTURE.md / CLAUDE.md rows, ADR index, full test suite, manual run against the backend.

---

## STEP-BY-STEP TASKS

### CREATE `docs/backend-shopping-lists-request.md`

- **IMPLEMENT**: The backend contract above, formatted like `docs/backend-auto-capture-request.md`
  (From/To/Date/Why header → Concepts → Data → Endpoints table → Invariants → "what mobile consumes"
  examples). Date it today. Include the optional `GET /transactions?from=&to=` ask as a clearly
  marked nice-to-have slice.
- **PATTERN**: `docs/backend-auto-capture-request.md` (header + section structure)
- **VALIDATE**: `test -s docs/backend-shopping-lists-request.md && echo OK`

### CREATE `.claude/ADR/ADR-015-shopping-lists-pre-expense.md` + UPDATE `.claude/ADR/README.md`

- **IMPLEMENT**: Status Accepted; relates to ADR-011 (context), ADR-012 (RBAC), ADR-014 (server-side
  money actions). Record the resolved-decisions table above (checkbox model, optional per-item
  price + required editable checkout amount, one-shot lifecycle, context scoping, server-side
  checkout, transactions-stack placement). North star: reusable templates/duplicate, item status
  enum, per-item spend analytics, server-side date filtering. Add the index row.
- **PATTERN**: `.claude/ADR/ADR-014-auto-capture-domain-model.md` (tone + structure), `ADR-000-template.md`
- **GOTCHA**: `.gitignore` ignores all of `.claude/` — `git add -f` the ADR and this plan at commit time.
- **VALIDATE**: `grep -q "ADR-015" .claude/ADR/README.md && echo OK`

### UPDATE `src/services/api/baseApi.js`

- **ADD**: `'ShoppingList'` to the `tagTypes` array.
- **VALIDATE**: `grep -q "ShoppingList" src/services/api/baseApi.js && echo OK`

### CREATE `src/services/api/shoppingLists.js`

- **IMPLEMENT**: `injectEndpoints` with a comment header citing the request doc + ADR-015:
  - `getShoppingLists` — arg `{ status?, team_id? }`, filter serialization + `withTeam` (MIRROR
    `transactions.js:12-26`); `providesTags` per-id + LIST tag like `transactions.js:22-25`.
  - `getShoppingList` — arg `{ id, team_id? }`.
  - `addShoppingList` / `updateShoppingList` / `deleteShoppingList` — `{ team_id, ...body }`
    destructured out of the body, `withTeam` on the URL; invalidate the LIST tag / per-id.
  - `getItems` — arg `{ list_id, team_id? }` → `/shopping-list-items?list_id=`; provides
    `[{ type: 'ShoppingList', id: `ITEMS-${list_id}` }]`.
  - `addItem` / `updateItem` / `deleteItem` — flat `/shopping-list-items` (MIRROR alias mutations in
    `sources.js:33-42`), each invalidating that list's ITEMS tag + per-id list tag (checked count
    shows on the index rows).
  - `checkoutList` — `{ id, team_id, ...body }` → `POST withTeam(`/shopping-lists/${id}/checkout`, team_id)`;
    `invalidatesTags: (r, e, { id }) => [{ type: 'ShoppingList', id }, LIST_TAG, 'Transaction', 'Balance']`
    (MIRROR `captures.js` confirm).
  - `updateItem` toggle should feel instant in-store: add an `onQueryStarted` optimistic patch of the
    `getItems` cache (RTK Query `updateQueryData`), rolled back on error. Keep it to `checked` only.
- **IMPORTS**: `baseApi`, `withTeam`
- **GOTCHA**: `team_id` NEVER in a body — destructure it out of every mutation arg. No team fields
  in the checkout body at all.
- **VALIDATE**: `npm test -- src/services/api/endpoints.test.js` (after next task)

### UPDATE `src/services/api/endpoints.test.js`

- **ADD**: a `describe('shopping lists — URLs, bodies, invalidation (ADR-015)')` block (MIRROR the
  sources block, lines 262–300): list URL with `?status=open&team_id=5`; item POST body; checkout →
  `/shopping-lists/7/checkout?team_id=5` with `{ amount: 420.5, category_id: 2 }` body and NO
  team_id in body; checkout refetches `/balance` (MIRROR `waitForBalanceCalls` usage, lines 347–358).
- **VALIDATE**: `npm test -- src/services/api/endpoints.test.js`

### UPDATE `src/i18n/locales/en-US.json` AND `src/i18n/locales/es-MX.json`

- **ADD**: `lists.*` namespace (title, new, name placeholder, open, purchased, empty, items,
  addItem, itemName, price, qty, checkedProgress e.g. `"{{done}}/{{total}}"`, estTotal, checkout,
  checkoutTitle, amount, category, confirmCheckout, checkedOut, deleteConfirm, frozenHint,
  viewTransaction) and `transactions.filterAll` / `transactions.month` keys as needed by Part 2.
  Both locales, real Spanish (match existing tone).
- **VALIDATE**: `node -e "['en-US','es-MX'].forEach(l=>{const j=require('./src/i18n/locales/'+l+'.json'); if(!j.lists) throw l})" && echo OK`

### CREATE `src/screens/ShoppingLists/ListScreen.jsx`

- **IMPLEMENT**: `ScreenHeader back title={t('lists.title')}`; status chips `open | purchased`
  (default `open`); `useGetShoppingListsQuery({ status, team_id })`; FlatList of Cards — name,
  checked/total progress, `purchased` rows show date + a muted transfer-style badge; tap →
  `router.push({ pathname: '/(tabs)/transactions/lists/[id]', params: { id } })`. Create: FAB
  (gated by `canAdd`) opens an inline name Field + save (MIRROR create→`router.replace` into the
  detail from `Sources/EditScreen.jsx:69-72`).
- **PATTERN**: `src/screens/Transactions/ListScreen.jsx` (list + chips + FAB + QueryBoundary + pull-to-refresh)
- **GOTCHA**: pass `team_id` into every hook; `usePermissions()` for `canAdd`/`canEditRow`.
- **VALIDATE**: `npm test` (suite green; screen exercised in next test task)

### CREATE `src/screens/ShoppingLists/DetailScreen.jsx`

- **IMPLEMENT**:
  - Load list (`useGetShoppingListQuery`) + items (`useGetItemsQuery`).
  - **Items section** (MIRROR `AliasesSection`, `Sources/EditScreen.jsx:151-238`): rows with a
    checkbox `Pressable` (Ionicons `checkbox`/`square-outline`, toggling `updateItem { checked }`),
    name (strikethrough style when checked), optional `qty × price`, trash icon; add-item Card at
    the bottom (name required, price/qty optional, decimal keyboard).
  - **Running total**: sum of checked items' `qty * price` (skip null prices) rendered with
    `MoneyText` (currency from `useGetBalanceQuery(teamId)` like `Transactions/ListScreen.jsx:27-28`).
  - **Checkout**: `AppButton` (visible while `status === 'open'` and ≥1 item checked, gated by
    `canEditRow(list)`) expands an inline Card: amount Field prefilled with the running total
    (editable, validate `> 0` at the boundary), category chips (`useGetCategoriesQuery(teamId)`,
    preselect `list.category_id`), confirm → `checkoutList(...).unwrap()` → `router.back()`.
    Errors via `Alert.alert` (backend `400` for the available rule surfaces as-is).
  - **Purchased state**: everything read-only, `frozenHint` copy, link to
    `/(tabs)/transactions/${list.transaction_id}`.
  - Delete list (own-row gated) with confirm Alert, MIRROR `Sources/EditScreen.jsx:78-94`.
- **PATTERN**: `Sources/EditScreen.jsx` + `TransactionForm.jsx` (amount conventions)
- **GOTCHA**: React Compiler is on — no manual memoization; `makeStyles(colors)` factory.
- **VALIDATE**: `npm test -- src/screens/ShoppingLists/DetailScreen.test.jsx` (next task)

### CREATE `src/screens/ShoppingLists/DetailScreen.test.jsx`

- **IMPLEMENT**: behavioral tests (MIRROR `src/screens/Inbox/index.test.jsx` + `renderWithStore`):
  toggling an item PUTs `{ checked: true }` to `/shopping-list-items/:id`; checkout sends the edited
  amount + category to `/shopping-lists/:id/checkout` with no team_id in the body; purchased list
  renders no checkout button. Test contracts/callbacks, never styles.
- **VALIDATE**: `npm test -- src/screens/ShoppingLists/DetailScreen.test.jsx`

### CREATE `app/(tabs)/transactions/lists/index.jsx` AND `app/(tabs)/transactions/lists/[id].jsx`

- **IMPLEMENT**: 1-line shims: `export { default } from '../../../../src/screens/ShoppingLists/ListScreen';`
  (and `DetailScreen`). Check `app/(tabs)/transactions/_layout.jsx` — if it enumerates screens,
  register the new ones; headers stay hidden app-wide.
- **GOTCHA**: static segment `lists` correctly wins over the sibling dynamic `[id].jsx` in
  expo-router — no conflict, but verify the route resolves in Metro. Mind the extra `../` (files
  are one level deeper).
- **VALIDATE**: `npx expo export --platform ios --output-dir /tmp/expo-export-check 2>&1 | tail -1` (bundles without route errors) or launch Metro manually

### UPDATE `src/screens/Transactions/ListScreen.jsx` — header entry point

- **ADD**: cart entry to the `ScreenHeader` `right` slot (Ionicons `cart-outline`) →
  `router.push('/(tabs)/transactions/lists')`. Check `ScreenHeader.jsx` for the `right` prop shape
  (Dashboard uses it for the transfer action — copy that usage).
- **VALIDATE**: `npm test`

### UPDATE `src/utils/dates.js` — month names helper (Part 2)

- **ADD**: `export const monthShortNames = (locale) => Info.months('short', { locale });`
  (import `Info` from luxon). Add a case to `src/utils/dates.test.js`.
- **VALIDATE**: `npm test -- src/utils/dates.test.js`

### UPDATE `src/screens/Transactions/ListScreen.jsx` — month/year filter (Part 2)

- **IMPLEMENT**:
  - State: `const [monthFilter, setMonthFilter] = useState(null); // null = all | { year, month }`.
  - UI, second filter row under the type chips: an "All" Chip (active when `monthFilter == null`),
    then a year stepper (chevron-back / year text / chevron-forward `Pressable`s, defaulting to the
    current year, forward disabled beyond it) and a horizontal `ScrollView` of 12 month Chips
    (`monthShortNames(i18n.language)`); tapping a month sets `{ year, month }`, tapping the active
    month or "All" clears it.
  - Filtering stays client-side and composes with the type filter:
    `const visible = monthFilter ? data?.filter((tx) => (tx.occurred_at ?? '').startsWith(`${monthFilter.year}-${String(monthFilter.month).padStart(2, '0')}`)) : data;`
    Feed `visible` to the FlatList and to `QueryBoundary`'s `isEmpty`.
  - i18n: use the keys added earlier; get `i18n` from `useTranslation()`.
- **PATTERN**: existing `TYPE_FILTERS` chips (lines 15, 72–76)
- **GOTCHA**: keep the server query args unchanged (type/category/team only) — do NOT send month
  params; `occurred_at` is a plain date string, so prefix match needs no luxon parsing.
- **VALIDATE**: `npm test`

### CREATE `src/screens/Transactions/ListScreen.test.jsx` (month filter behavior)

- **IMPLEMENT**: render with mocked fetch returning transactions across two months; assert all rows
  render under "All", only matching rows after selecting a month/year, and empty state when a month
  has no rows. MIRROR `Inbox/index.test.jsx` harness.
- **VALIDATE**: `npm test -- src/screens/Transactions/ListScreen.test.jsx`

### UPDATE `ARCHITECTURE.md`, `CLAUDE.md`, `PRD.md`

- **UPDATE**: ARCHITECTURE §1 nav graph (lists nodes under the transactions stack), §2 endpoint list
  (`shoppingLists.js` + tag), §4 file map; CLAUDE.md Key-files table rows (`shoppingLists.js`,
  `src/screens/ShoppingLists/`) + a Conventions bullet (checkout posts server-side; purchased lists
  frozen; month filter is client-side); PRD only if the contract section is extended — otherwise the
  request doc is the contract reference.
- **VALIDATE**: `grep -q "ShoppingList" ARCHITECTURE.md CLAUDE.md && echo OK`

---

## TESTING STRATEGY

### Unit Tests
- Endpoint block in `endpoints.test.js` — URLs, bodies (team_id stripped), checkout invalidation
  cascade to `Balance`.
- `dates.test.js` — `monthShortNames` returns 12 localized names.

### Integration (screen) Tests
- `DetailScreen.test.jsx` — toggle contract, checkout contract, purchased read-only.
- `ListScreen.test.jsx` (transactions) — month filter show/hide behavior.

### Edge Cases
- Checkout with items that have no prices → amount field starts empty/0, confirm disabled until `> 0`.
- Backend `400` on checkout (available rule) → Alert surfaces `error`, list stays `open`.
- Optimistic toggle rollback on a failed PUT.
- Month filter across year boundary (Dec 2025 vs Jan 2026) — year stepper drives the prefix.
- Guest context: no FAB, no checkout, checkboxes disabled (`usePermissions`).

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
No linter is configured — rely on Metro/Jest transforms failing on syntax errors.

### Level 2: Unit Tests
```bash
npm test -- src/services/api/endpoints.test.js
npm test -- src/utils/dates.test.js
```

### Level 3: Integration Tests
```bash
npm test        # full suite, zero regressions
```

### Level 4: Manual Validation (needs the backend branch with shopping lists)
```bash
cd ../../Node/Projects/balance && NODE_ENV=stage npm start   # backend
APP_ENV=dev npx expo start                                    # app (API_URL in .env.dev)
```
- Create list → add items (some priced) → toggle in "store" → checkout with edited amount →
  transaction appears in history with the list name; dashboard `available` drops.
- Repeat inside a team context; verify the expense lands in the team ledger.
- Month filter: select current month → only its rows; "All" restores; empty month shows empty state.

### Level 5: Health
```bash
npx expo-doctor
npx expo-modules-autolinking verify -v   # still Expo-Go safe (no new native modules)
```

---

## ACCEPTANCE CRITERIA

- [ ] `docs/backend-shopping-lists-request.md` fully specifies tables, endpoints, invariants, and examples
- [ ] ADR-015 recorded + indexed; plan force-added (`.claude/` is gitignored)
- [ ] Lists CRUD + item checkboxes + checkout work end-to-end in personal AND team contexts
- [ ] Checkout posts exactly one expense titled with the list name, in the list's context, server-side
- [ ] Purchased lists are frozen and link to their transaction; delete never touches the ledger
- [ ] All write affordances RBAC-gated via `usePermissions`
- [ ] Month/year filter composes with type chips; "All" restores; no server params added
- [ ] `npm test` fully green; no new native modules (Expo Go intact)
- [ ] ARCHITECTURE.md / CLAUDE.md synced

## COMPLETION CHECKLIST

- [ ] All tasks completed in order, each validation run immediately
- [ ] Full suite green (`npm test`)
- [ ] Manual flow verified against the running backend (or explicitly reported as blocked on the backend slice)
- [ ] Conventional commits: `docs:` (request doc + ADR), `feat:` (data layer), `feat:` (screens),
      `feat:` (month filter), `test:`, `docs:` (sync) — atomic, in that order

## NOTES

- **Cross-repo dependency**: Part 1's manual validation is blocked until the `balance` backend
  implements `docs/backend-shopping-lists-request.md` (same flow as auto-capture: request doc →
  backend agent implements in `/Users/jayro/Dev/Node/Projects/balance` → client verifies). All
  client code + tests can land first against mocks. Part 2 has no backend dependency at all.
- **Deliberate lean choices** (recorded in ADR-015 north star): no templates/duplicate-list, no item
  status enum, no per-item→category mapping, no server-side date filter, no offline outbox for
  in-store toggles (optimistic patch covers the feel; ADR-007's local-first phase covers the rest).
- The `qty` field is a soft nice-to-have — if it noises up the add-item row, ship name + price only
  and leave `qty` in the schema (backend defaults it to 1).
