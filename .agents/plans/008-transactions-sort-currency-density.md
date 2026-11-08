# Feature: Transactions sort + currency/UI density pass + dashboard vault navigation

The following plan should be complete, but it's important that you validate documentation and codebase
patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils/components and import paths. Import from the right
files (`src/components/ui/index.js` barrel for UI atoms, `useTheme` from `src/hooks/useTheme`).

## Feature Description

A five-part UI density + usability pass on the money-facing screens:

1. **Transactions sort** — the list has no sort at all today; rows render in whatever order the backend
   returns. Add a client-side date sort defaulting to **newest-first**, flipped by a single icon toggle.
2. **Currency noise** — `formatMoney` uses `Intl.NumberFormat(style:'currency')`, which renders MXN as
   `MX$1,234.50` in an `en-US` locale. That 3-glyph prefix repeated on every row is what breaks small
   screens. Switch to `currencyDisplay:'narrowSymbol'` (`$1,234.50`) **and** add a bare-number mode
   (`1,234.50`) used in dense list rows where the currency is already established by the screen.
3. **Cycling figures** — two cramped multi-figure blocks (the Transactions Balance/Income/Expense bar and
   the Dashboard hero's Total/Available/Lent stack) collapse to a single tappable figure that cycles
   through its metrics, with a dot indicator for discoverability.
4. **Dashboard vault navigation** — dashboard vault cards are dead ends; make them navigate to the vault
   detail screen the way the shopping-list cards already do.
5. **iOS month-chip collapse** — on iPhone the horizontal month-chip `ScrollView` collapses to minimum
   width and the labels don't render; Android is fine. Give it a proper flex basis.

## User Story

As a **person tracking my money on a phone**
I want **the newest transactions on top, a compact currency format, one figure at a time in the summary
blocks, and vault cards that open the vault**
So that **the numbers stay readable on a small screen and I can reach my vaults in one tap**

## Problem Statement

- Transaction order is backend-defined and unsorted — the most recent activity is not reliably visible.
- The MXN currency prefix (`MX$`) is repeated on every row and every summary figure. On narrow devices
  the three-cell totals bar and the hero card run out of horizontal space; figures squash together with
  no gutter.
- The Dashboard renders vault cards with balances but no way to act on them, while the sibling shopping-
  list cards navigate — an inconsistency users read as a bug.
- On iOS the month filter row renders chips at collapsed width, hiding the month labels entirely.

## Solution Statement

- **Sort:** a `sortDir` state (`'desc' | 'asc'`) applied after the existing type/date filtering; icon
  toggle lives in the `ScreenHeader` `right` slot (NOT the already-crowded `dateRow` — see Task 8).
- **Currency:** one function (`formatMoney`) gains a `narrowSymbol` display and an options bag with
  `showCurrency`; `MoneyText` forwards it. Dense rows opt out of the symbol; headline figures keep it.
- **Cycling:** one shared `CyclingFigure` atom in `src/components/ui/` driving both call sites.
- **Vault nav:** `Card`'s existing `onPress` prop + `router.navigate` (never `push`) + an
  `unstable_settings` anchor on the vaults stack.
- **iOS chips:** `flex: 1` on the `ScrollView`'s `style` (not `contentContainerStyle`) plus
  `flexShrink: 0` on the year button.

## Feature Metadata

**Feature Type**: Enhancement (+ one Bug Fix)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `src/utils/money.js`, `src/components/ui/`, `src/screens/Transactions/`,
`src/screens/Dashboard/`, `src/screens/Vaults/`, `src/screens/Loans/`, `app/(tabs)/vaults/_layout.jsx`,
`src/i18n/locales/*`
**Dependencies**: None new. Existing: `@expo/vector-icons` (Ionicons), `expo-router`, `react-i18next`,
`@testing-library/react-native`.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING

- `src/utils/money.js` (whole file, 9 lines) — Why: the single money formatter; every change in part 2
  lands here. Note the `try/catch` fallback for invalid currency codes.
- `src/utils/money.test.js` — Why: the assertion style to preserve (substring matching, **never** exact
  Intl symbol/spacing, because bare Node ICU differs from device ICU).
- `src/components/ui/MoneyText.jsx` (whole file, 6 lines) — Why: the component to extend.
- `src/components/ui/index.js` — Why: the barrel every new UI atom must be exported from.
- `src/components/ui/Card.jsx` (lines 5-16) — Why: `Card` already accepts `onPress` and renders a
  `Pressable` with a pressed-opacity state. Do NOT wrap `Card` in your own `Pressable` for Task 11.
- `src/components/ui/Chip.jsx` — Why: chip layout; relevant to the iOS width bug.
- `src/components/ui/ScreenHeader.jsx` (lines 8-25) — Why: the `right` slot is a single node; to host two
  actions, pass a `<View style={{flexDirection:'row', ...}}>` wrapping both pressables.
- `src/screens/Transactions/ListScreen.jsx` — Why: the primary file for parts 1, 3 and 5.
  - lines 49-57: the `visible` derivation (filter chain) — sort appends here.
  - lines 89-117: `renderItem`, the transaction row (`MoneyText` at 107-111).
  - lines 121-129: `ScreenHeader` with the existing cart `right` action.
  - lines 137-148: `dateRow` — the horizontal month `ScrollView` + year dropdown (the iOS bug).
  - lines 150-165: the three-cell totals bar to collapse.
  - lines 226-241: `totals` / `totalCell` / `totalDivider` / `totalLabel` / `totalValue` styles.
- `src/screens/Transactions/ListScreen.test.jsx` — Why: the test harness to extend. Note the module
  mocks at the top (`@expo/vector-icons`, `react-native-safe-area-context`, `expo-router`), the
  `global.fetch` stub, and the `money()` helper that derives expected text via `formatMoney`.
- `src/screens/Dashboard/index.jsx` — Why: primary file for parts 3 and 4.
  - lines 18-39: `VaultRow` — a bare `Card`, no `onPress` (Task 11).
  - lines 112-125: the hero card, `Total` + `availRow`(Available) + conditional `availRow`(Lent).
  - lines 141-155: the shopping-list card — **the exact navigation pattern to mirror**.
  - lines 165-175: `hero` / `heroLabel` / `heroTotal` / `availRow` / `heroAvail` styles.
- `src/screens/Vaults/ListScreen.jsx` (lines 35-61) — Why: row `MoneyText` call sites for part 2.
- `src/screens/Loans/ListScreen.jsx` (lines 36-62) — Why: row `MoneyText` call sites for part 2.
- `src/screens/Vaults/DetailScreen.jsx` (lines 130-200) — Why: headline figure (keeps the symbol) vs
  history rows (drop the symbol).
- `src/screens/Loans/DetailScreen.jsx` (lines 130-200) — Why: same split as vaults.
- `app/(tabs)/transactions/_layout.jsx` — Why: the `unstable_settings = { initialRouteName: 'index' }`
  pattern to replicate on the vaults stack.
- `app/(tabs)/vaults/_layout.jsx` — Why: **currently missing** that anchor (Task 12).
- `src/i18n/locales/en-US.json`, `src/i18n/locales/es-MX.json` — Why: both must gain every new key.
- `.claude/ADR/ADR-013-team-color-and-theming.md` — Why: the `makeStyles(colors)` + `useTheme()` rule and
  the "never hardcode white on the accent, use `colors.primaryText`" rule.

### Read this commit before Task 11

```bash
git show 8780c91
```

It fixed a cross-tab deep-link regression: the Dashboard pushed into the transactions tab's stack, which
had no `index` anchor, so the tab was stranded on the pushed screen with no way back. Two fixes:
`unstable_settings` on the target stack, and `router.navigate` instead of `router.push`. **The dashboard
→ vault shortcut is the same shape of link and will reproduce the same bug unless both fixes are
applied** (Tasks 11 + 12).

### New Files to Create

- `src/components/ui/CyclingFigure.jsx` — the shared tap-to-cycle figure atom.
- `src/components/ui/CyclingFigure.test.jsx` — behavior tests for the atom.
- `src/screens/Dashboard/index.test.jsx` — does not exist yet; covers hero cycling + vault navigation.

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [MDN `Intl.NumberFormat` — `currencyDisplay`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#currencydisplay)
  - Section: `currencyDisplay` option values (`symbol` | `narrowSymbol` | `code` | `name`)
  - Why: `narrowSymbol` is exactly the "use `$` instead of `MX$`" behavior we want.
  - **Gotcha:** `narrowSymbol` was added in ES2020 and throws `RangeError` on older ICU builds. The
    existing `try/catch` in `formatMoney` already covers this — do not remove it.
- [React Native — `ScrollView` `horizontal` inside a row](https://reactnative.dev/docs/scrollview#horizontal)
  - Why: a horizontal `ScrollView` measures its content on the main axis as unbounded; placed inside a
    `flexDirection: 'row'` parent with no flex basis, iOS collapses it to its minimum width while
    Android's measurement pass happens to give it the remaining space. `flex: 1` on the **`style`** prop
    (not `contentContainerStyle`) is the fix.
- [expo-router — `unstable_settings` / `initialRouteName`](https://docs.expo.dev/router/advanced/router-settings/)
  - Why: anchors a nested stack so a cross-tab deep link sits on top of `index` instead of replacing it.
- [expo-router — `router.navigate` vs `push`](https://docs.expo.dev/versions/latest/sdk/router/#routernavigatehref)
  - Why: `navigate` updates params on an existing screen instead of stacking duplicates.

### Patterns to Follow

**Theming (ADR-013) — mandatory in every touched component:**

```jsx
const { colors } = useTheme();
const styles = makeStyles(colors);
// ...
const makeStyles = (colors) => StyleSheet.create({ /* ... */ });
```

Never import a static `colors` object (there is no static `colors` export in `src/components/theme.js`).
On the hero (accent background) use `colors.primaryText` — **never** `'#fff'`.

**React Compiler is enabled.** Do NOT add `useCallback`/`useMemo` for callback identity or derived
values. The existing `useMemo`s in `ListScreen.jsx` are pre-existing — leave them, but do not add new
ones. (The only hand-written `useCallback` that must stay is `onRefresh`, because it is passed to
`RefreshControl` and its behavior — not its identity — is load-bearing.)

**Cross-tab navigation (from `Dashboard/index.jsx:143-146`):**

```jsx
<Card onPress={() => router.navigate({ pathname: '/(tabs)/vaults/[id]', params: { id: vault.id } })}>
```

**Test style (from `src/screens/Transactions/ListScreen.test.jsx`):** mock `@expo/vector-icons`,
`react-native-safe-area-context` and `expo-router`; stub `global.fetch`; render via
`renderWithStore` from `src/test-utils/renderWithStore`. Assert **behavior** — rendered text, ordering,
callback effects — **never** styles, colors, or layout. See memory `feedback-test-behavior-not-design`.

**i18n:** keys go in **both** `en-US.json` and `es-MX.json`. Untranslated keys render as the raw key in
tests (the harness has no real translations loaded), which is why tests assert on e.g.
`'transactions.allYears'`.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (shared primitives — must land first)

`formatMoney` and `MoneyText` are imported by every screen in this plan, and `CyclingFigure` is consumed
by two of them. Both must be complete and tested before any screen task starts, or parallel workers will
collide on the same files.

**Tasks:** 1, 2, 3, 4 (money + MoneyText + CyclingFigure + i18n keys)

### Phase 2: Core Implementation (screens — parallelizable, disjoint file ownership)

Three independent workstreams, each owning its own files:

- **Stream A — Transactions:** `src/screens/Transactions/ListScreen.jsx` + its test (Tasks 5-8)
- **Stream B — Dashboard:** `src/screens/Dashboard/index.jsx` + new test + `app/(tabs)/vaults/_layout.jsx`
  (Tasks 9-12)
- **Stream C — Dense rows elsewhere:** `src/screens/Vaults/*`, `src/screens/Loans/*` (Task 13)

No file appears in more than one stream.

### Phase 3: Integration

**Tasks:** barrel export (folded into Task 3), i18n completeness check (Task 14).

### Phase 4: Testing & Validation

**Tasks:** 15 (full suite + manual device checklist).

---

## STEP-BY-STEP TASKS

Execute in order. Tasks 5-13 may run in parallel across the three streams **only after Phase 1 is
merged**.

---

### Task 1 — UPDATE `src/utils/money.js`

- **IMPLEMENT**: Extend `formatMoney(amount, currency = 'USD', options = {})` with a `showCurrency`
  option (default `true`).
  - When `showCurrency` is true: `Intl.NumberFormat(undefined, { style: 'currency', currency,
    currencyDisplay: 'narrowSymbol' })`.
  - When false: `Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` —
    grouped, 2-decimal, no symbol, no currency code.
  - Keep the existing `try/catch`. The catch must still return `` `${currency} ${value.toFixed(2)}` ``
    when `showCurrency` is true, and `value.toFixed(2)` when it is false.
- **PATTERN**: `src/utils/money.js:2-9` — keep the same shape, the `Number(amount ?? 0)` coercion, and
  the leading comment explaining the decimal contract (PRD §4).
- **IMPORTS**: none.
- **GOTCHA**: `currencyDisplay: 'narrowSymbol'` throws `RangeError` on old ICU — that is precisely what
  the `catch` is for, so a device without it degrades to `MXN 1234.50` rather than crashing. Do not
  "simplify" the catch away. Also: do NOT change the default currency (`'USD'`) or the signature order —
  `src/utils/activity.js:7` calls `formatMoney(summary.amount, currency)` positionally.
- **VALIDATE**: `npx jest src/utils/money.test.js`

### Task 2 — UPDATE `src/utils/money.test.js` and `src/components/ui/MoneyText.jsx` (+ its test)

- **IMPLEMENT**:
  - `MoneyText`: add a `showCurrency = true` prop, forwarded as
    `formatMoney(amount, currency, { showCurrency })`.
  - `money.test.js`: add cases for the bare mode — `formatMoney(1234.5, 'MXN', { showCurrency: false })`
    contains `1,234.50` and does **not** match `/\$|MXN|MX/`; nullish → `0.00`; the invalid-code fallback
    with `showCurrency: false` returns `'12.00'` (no code prefix).
  - `MoneyText.test.jsx`: add a case that `showCurrency={false}` renders the number without a currency
    marker, and that the default still renders one.
- **PATTERN**: `src/utils/money.test.js:6-9` — the comment explaining *why* assertions are substring-
  based. Match that style; do not assert exact symbols.
- **IMPORTS**: `MoneyText.jsx` already imports `formatMoney` from `'../../utils/money'`.
- **GOTCHA**: Do not assert `formatMoney(1234.5, 'MXN')` equals `'$1,234.50'` — the jest environment's
  ICU may be `small-icu` and produce `MXN 1,234.50` or `MX$1,234.50`. Assert the **number substring**
  and, for the bare mode, the **absence** of any currency marker. The absence assertion is the only one
  that is ICU-stable and it is the actual behavior under test.
- **VALIDATE**: `npx jest src/utils/money.test.js src/components/ui/MoneyText.test.jsx`

### Task 3 — CREATE `src/components/ui/CyclingFigure.jsx` (+ barrel export)

- **IMPLEMENT**: A presentational atom that shows one of N money figures and advances on tap.

  **Design decision — shared component, not two local copies.** The two call sites differ only in
  styling; the *behavior* (steps, index state, wrap-around, index clamping when the step list shrinks,
  dot indicator, a11y) is identical and non-trivial, and the clamping edge case is exactly the kind of
  thing that gets fixed in one copy and not the other. One atom + one behavior test beats two
  hand-rolled `useState` loops. This is not a premature abstraction: it has two real consumers on day
  one.

  ```jsx
  // steps: [{ key, label, amount, color }]  — `color` is the value text color for that step.
  export const CyclingFigure = ({
    steps, currency, showCurrency = true, labelStyle, valueStyle, dotColor, testID,
  }) => { /* ... */ }
  ```

  - `const [i, setI] = useState(0)`; **render index is `steps.length ? i % steps.length : 0`** so a step
    list that shrinks (Lent disappearing when a loan is fully repaid) can never index out of bounds
    without an effect.
  - Tap anywhere on the figure → `setI((n) => n + 1)`. Wrap comes free from the modulo.
  - Render: label (`labelStyle`) + `MoneyText` (`valueStyle` merged with the active step's `color`) +
    a dot row — one dot per step, the active one filled with `dotColor`, the rest at reduced opacity.
  - Render **no dot row when `steps.length < 2`** (a single figure has nothing to cycle to).
  - Guard `steps` empty/nullish → render nothing.
  - Wrap in `Pressable` with `accessibilityRole="button"`, `accessibilityLabel` = the active step's
    label, and spread `testID` onto the `Pressable`.
- **PATTERN**: `src/components/ui/Chip.jsx` — the file shape for a UI atom: named export,
  `useTheme()` + `makeStyles(colors)` at the bottom, a leading comment explaining the prop that isn't
  obvious (`dot` there, `steps`/`color` here).
- **IMPORTS**: `{ useState }` from react; `{ Pressable, StyleSheet, Text, View }` from react-native;
  `{ MoneyText } from './MoneyText'`; `{ font, spacing } from '../theme'`;
  `{ useTheme } from '../../hooks/useTheme'`.
- **GOTCHA**: `dotColor` must be passed in by the consumer, because the hero sits on the accent
  (`colors.primaryText`) and the totals bar sits on a card (`colors.muted`) — the atom cannot know.
  Do NOT hardcode `'#fff'` anywhere (ADR-013). Also export from `src/components/ui/index.js` in the
  same alphabetical-ish grouping as the rest.
- **VALIDATE**: `npx jest src/components/ui` — plus write `CyclingFigure.test.jsx` now:
  - renders the first step's label and amount
  - a press advances to the second step
  - pressing past the last step wraps to the first
  - a single-step list renders the figure and no crash on press
  - shrinking `steps` (rerender with fewer) while parked on the last index renders the clamped step,
    not a blank

### Task 4 — UPDATE `src/i18n/locales/en-US.json` and `src/i18n/locales/es-MX.json`

- **IMPLEMENT**: Add under `transactions`:
  - `"sortNewest": "Newest first"` / `"Más recientes primero"`
  - `"sortOldest": "Oldest first"` / `"Más antiguos primero"`
  - `"sort": "Sort"` / `"Ordenar"`
- **PATTERN**: existing `transactions.allYears` / `transactions.net` entries.
- **GOTCHA**: Both files, identical key sets. No new `dashboard.*` keys are needed — the hero reuses
  `dashboard.total`, `dashboard.available`, `dashboard.lent`, and the totals bar reuses
  `transactions.net`, `transactions.income`, `transactions.expense`.
- **VALIDATE**:
  ```bash
  python3 -c "
  import json
  a=json.load(open('src/i18n/locales/en-US.json')); b=json.load(open('src/i18n/locales/es-MX.json'))
  def keys(d,p=''):
      out=set()
      for k,v in d.items():
          out |= keys(v, p+k+'.') if isinstance(v,dict) else {p+k}
      return out
  d=keys(a)^keys(b); print('MISMATCH:',sorted(d)) if d else print('i18n keys in sync')
  "
  ```

---

### Stream A — Transactions (`src/screens/Transactions/ListScreen.jsx` + test)

### Task 5 — ADD date sort state + derivation to `src/screens/Transactions/ListScreen.jsx`

- **IMPLEMENT**:
  - `const [sortDir, setSortDir] = useState('desc');` next to the existing filter state (~line 42-44).
  - Inside the existing `visible` `useMemo` (lines 49-57), after the type/date filtering, sort a **copy**:
    ```js
    const dir = sortDir === 'desc' ? -1 : 1;
    rows = rows ? [...rows].sort((a, b) => {
      const d = String(a.occurred_at ?? '').localeCompare(String(b.occurred_at ?? ''));
      return d !== 0 ? d * dir : (b.id - a.id);
    }) : rows;
    ```
  - Add `sortDir` to the `useMemo` dependency array.
- **PATTERN**: `src/screens/Transactions/ListScreen.jsx:49-57` — the existing filter chain reassigns
  `rows` step by step; append one more step in the same style.
- **IMPORTS**: none new.
- **GOTCHA**: **Never sort `data` in place** — it is the RTK Query cache array and mutating it corrupts
  the store and breaks referential-equality checks. Always spread first. `occurred_at` is a plain
  `YYYY-MM-DD` string, so lexicographic comparison is chronologically correct — do not parse to `Date`.
  Tie-break is `b.id - a.id` (newest id first) in **both** directions on purpose: it keeps same-day rows
  stable rather than mirroring, which is what "stable" means to a user scanning a day's entries.
- **VALIDATE**: `npx jest src/screens/Transactions`

### Task 6 — ADD the sort toggle to the `ScreenHeader` right slot

- **IMPLEMENT**: Replace the single cart `Pressable` at `ListScreen.jsx:124-128` with a row containing
  **both** actions:
  ```jsx
  right={
    <View style={styles.headerActions}>
      <Pressable
        hitSlop={10}
        testID="sort-toggle"
        accessibilityLabel={t(sortDir === 'desc' ? 'transactions.sortNewest' : 'transactions.sortOldest')}
        onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
      >
        <Ionicons name={sortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={24} color={colors.primary} />
      </Pressable>
      <Pressable hitSlop={10} testID="lists-link" onPress={() => router.push('/(tabs)/transactions/lists')}>
        <Ionicons name="cart-outline" size={24} color={colors.primary} />
      </Pressable>
    </View>
  }
  ```
  Add `headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) }` to `makeStyles`.
- **PATTERN**: `src/components/ui/ScreenHeader.jsx:22` — `right` is rendered as a bare child of the
  header row, so a `View` wrapper composes cleanly.
- **IMPORTS**: `View` is already imported in `ListScreen.jsx`.
- **GOTCHA**: The header slot — **not** the `dateRow`. `dateRow` is already the widest row on the screen
  and is the subject of the iOS collapse bug in Task 8; adding a third control there would make it
  worse. Keep the existing `testID="lists-link"` intact — `ListScreen.test.jsx` may reference it.
- **VALIDATE**: `npx jest src/screens/Transactions`

### Task 7 — REFACTOR the totals bar into a single `CyclingFigure`

- **IMPLEMENT**: Replace `ListScreen.jsx:150-165` (the three `totalCell`s and two `totalDivider`s) with:
  ```jsx
  <View style={styles.totals}>
    <CyclingFigure
      testID="totals-cycle"
      currency={currency}
      dotColor={colors.muted}
      labelStyle={styles.totalLabel}
      valueStyle={styles.totalValue}
      steps={[
        { key: 'net', label: t('transactions.net'), amount: totals.net, color: colors.text },
        { key: 'income', label: t('transactions.income'), amount: totals.income, color: colors.success },
        { key: 'expense', label: t('transactions.expense'), amount: totals.expense, color: colors.danger },
      ]}
    />
  </View>
  ```
  Keep the `totals` container style (card background, border, margins). Remove the now-unused
  `totalCell` and `totalDivider` styles. `showCurrency` stays default `true` here — this is a headline
  figure, per the user's decision.
- **PATTERN**: the metric colors are already established at `ListScreen.jsx:153/158/163`
  (`colors.text` / `colors.success` / `colors.danger`) — carry them over exactly.
- **IMPORTS**: add `CyclingFigure` to the existing `'../../components/ui'` barrel import.
- **GOTCHA**: `totals.net` can be negative and renders with a minus sign — that is correct and existing
  behavior (`ListScreen.test.jsx:86` asserts `money(-70)`). The order **must** be net → income → expense
  so that existing test stays meaningful and net remains the default view.
- **VALIDATE**: `npx jest src/screens/Transactions`

### Task 8 — FIX the iOS month-chip collapse in `dateRow`

- **IMPLEMENT**: In `ListScreen.jsx:138-143`, give the horizontal `ScrollView` a flex basis on its
  **`style`** prop and stop the year button from being squeezed:
  ```jsx
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.monthsScroll}
    contentContainerStyle={styles.months}
  >
  ```
  In `makeStyles`: add `monthsScroll: { flex: 1 }` and add `flexShrink: 0` to the existing `yearBtn`
  style. Also add `numberOfLines={1}` to the `<Text>` inside `src/components/ui/Chip.jsx:16` so a chip
  label can never wrap to zero-height in a constrained row.
- **PATTERN**: `dateRow` at `ListScreen.jsx:211` is `flexDirection: 'row'`; the `ScrollView` currently
  has **no `style` prop at all**, only `contentContainerStyle`.
- **IMPORTS**: none new.
- **GOTCHA**: This is the crux — **`flex: 1` must go on `style`, not `contentContainerStyle`.** The
  content container sizes the scrollable content; the outer `style` sizes the viewport. Putting flex on
  the content container is the common wrong fix and would make Android regress too. A horizontal
  `ScrollView` measures its main axis as unbounded, so without a flex basis on the viewport iOS resolves
  it to its minimum width (hence collapsed, label-less chips) while Android's measurement pass happens
  to hand it the remaining space — which is exactly the reported platform split.
  **`Chip.jsx` is shared** — it is the one file Stream A touches outside its own directory. Coordinate:
  the `numberOfLines` edit is one line and must not be duplicated by another stream.
- **VALIDATE**: `npx jest` (Chip has its own test: `src/components/ui/Chip.test.jsx`) — then the manual
  iOS check in Level 4.

### Task 9 — UPDATE `src/screens/Transactions/ListScreen.jsx` dense rows to drop the symbol

- **IMPLEMENT**: Add `showCurrency={false}` to the transaction row amount `MoneyText` at
  `ListScreen.jsx:107-111`.
- **PATTERN**: n/a — single prop addition.
- **GOTCHA**: Only the **row** amount. The totals bar (Task 7) keeps its symbol.
- **VALIDATE**: `npx jest src/screens/Transactions`

### Task 10 — EXTEND `src/screens/Transactions/ListScreen.test.jsx`

- **IMPLEMENT**: New behavior tests:
  - **default newest-first**: with the existing `txs` fixture under the default (current-year) filter,
    assert the rendered order is `JulyTx` (07-15), `LoanOut` (07-05), `MarchTx` (03-10). Read order via
    `screen.getAllByText(/Tx|LoanOut/)` or by mapping over rendered descriptions and comparing index
    positions — do **not** assert on styles.
  - **toggle flips to oldest-first**: `fireEvent.press(screen.getByTestId('sort-toggle'))` → order is
    `MarchTx`, `LoanOut`, `JulyTx`.
  - **cycling totals**: initially only the net figure is shown (`money(-70)` present, `money(70)` and
    `money(0)` absent); pressing `testID="totals-cycle"` shows income (`money(0)`); pressing again shows
    expense (`money(70)`); a third press returns to net.
- **PATTERN**: `ListScreen.test.jsx:48-53` for the render+`findByText` shape; `:11` for the `money()`
  helper.
- **GOTCHA**: The existing test at `:77-87` ("totals bar shows net/income/expense") asserts all three
  figures are on screen simultaneously — that is **no longer true** after Task 7. **Rewrite it** into the
  cycling test rather than deleting the coverage; the loan-exclusion assertion it carries (`LoanOut`
  visible in the list but excluded from totals) is important and must survive. Also note `money(0)` and
  `money(70)` are distinct strings, so presence/absence assertions are unambiguous.
  Add a `testID` to the row container in `renderItem` only if you cannot get a reliable order read from
  the descriptions — prefer not to.
- **VALIDATE**: `npx jest src/screens/Transactions --verbose`

---

### Stream B — Dashboard + vaults stack

### Task 11 — REFACTOR the Dashboard hero into a `CyclingFigure`

- **IMPLEMENT**: Replace `src/screens/Dashboard/index.jsx:112-125` with a hero `Card` containing one
  `CyclingFigure`:
  ```jsx
  <Card style={styles.hero}>
    <CyclingFigure
      testID="hero-cycle"
      currency={currency}
      dotColor={colors.primaryText}
      labelStyle={styles.heroLabel}
      valueStyle={styles.heroTotal}
      steps={[
        { key: 'total', label: t('dashboard.total'), amount: data?.total, color: colors.primaryText },
        { key: 'available', label: t('dashboard.available'), amount: data?.available, color: colors.primaryText },
        ...(data?.lent > 0
          ? [{ key: 'lent', label: t('dashboard.lent'), amount: data.lent, color: colors.primaryText }]
          : []),
      ]}
    />
  </Card>
  ```
  Remove the now-unused `availRow` and `heroAvail` styles.
- **PATTERN**: `Dashboard/index.jsx:165-169` — keep `hero` and `heroLabel`/`heroTotal` as-is.
- **IMPORTS**: add `CyclingFigure` to the existing `'../../components/ui'` barrel import.
- **GOTCHA**: All three step colors are `colors.primaryText` (ADR-013 — the hero sits on the team accent
  and must stay readable on any accent; **never** `'#fff'`). The Lent step is conditionally *absent*,
  not hidden — which is exactly why `CyclingFigure` clamps its index (Task 3): a user parked on Lent when
  a repayment lands would otherwise index past the end. Verify that behavior is covered.
- **VALIDATE**: `npx jest src/screens/Dashboard`

### Task 12 — ADD navigation to the Dashboard `VaultRow`

- **IMPLEMENT**:
  - `VaultRow` (`Dashboard/index.jsx:18-39`) takes an `onPress` prop, forwards it to `Card`'s existing
    `onPress`, and renders a `chevron-forward` affordance next to the balance in `vaultHead` —
    mirroring the shopping-list card at `:147-150`.
  - The caller at `:129` passes
    `onPress={() => router.navigate({ pathname: '/(tabs)/vaults/[id]', params: { id: v.id } })}`.
  - Add `showCurrency={false}` to the `VaultRow` balance and target `MoneyText`s (`:27`, `:34`).
- **PATTERN**: `src/screens/Dashboard/index.jsx:141-151` — the shopping-list card, verbatim shape.
  `src/components/ui/Card.jsx:8-13` — `Card` already becomes a `Pressable` when given `onPress`.
- **IMPORTS**: `Ionicons` is already imported in `Dashboard/index.jsx`.
- **GOTCHA**: **`router.navigate`, never `router.push`** — see `git show 8780c91`. `push` stacks a
  duplicate screen on every tap and strands the tab on a stale id.
- **VALIDATE**: `npx jest src/screens/Dashboard`

### Task 13 — ADD the stack anchor to `app/(tabs)/vaults/_layout.jsx`

- **IMPLEMENT**: Add above the component, with a comment mirroring the transactions one:
  ```jsx
  export const unstable_settings = { initialRouteName: 'index' };
  ```
- **PATTERN**: `app/(tabs)/transactions/_layout.jsx:7` — copy the comment's explanation, adapted to the
  Dashboard → vault shortcut.
- **GOTCHA**: **This is not optional.** Task 12 introduces exactly the cross-tab deep link that caused
  the `8780c91` regression: without the anchor, tapping a dashboard vault card mounts `vaults/[id]` as
  the sole entry in the vaults tab stack — no `index` beneath it — so the Vaults tab gets stuck on that
  vault, the vault list is unreachable, and back does nothing. Ship Tasks 12 and 13 together.
- **VALIDATE**: `npx expo-doctor` (route sanity) + the manual Level 4 navigation checklist.

### Task 14 — CREATE `src/screens/Dashboard/index.test.jsx`

- **IMPLEMENT**: New test file covering:
  - hero shows Total first; press `hero-cycle` → Available; press → Total again **when `lent` is 0**
    (i.e. only two steps, Lent is skipped entirely)
  - with `lent > 0` in the `/balance` fixture, the cycle is Total → Available → Lent → Total
  - pressing a vault card calls `router.navigate` with
    `{ pathname: '/(tabs)/vaults/[id]', params: { id } }`
- **PATTERN**: `src/screens/Transactions/ListScreen.test.jsx:1-46` — copy the mock block wholesale
  (config mock, `@expo/vector-icons`, `react-native-safe-area-context`, `expo-router`, the
  `jsonResponse` helper, the `global.fetch` stub, the `afterEach` microtask flush). The Dashboard fetches
  `/balance`, `/shopping-lists` and `/teams` — the fetch stub must branch on `req.url` for all three or
  return a sane default, or unhandled requests will reject and pollute the run.
  Mock `expo-router` with `useRouter: () => ({ push: pushSpy, navigate: navigateSpy })` and assert on
  `navigateSpy`.
- **GOTCHA**: `useUnreadActivity` also issues a request (`/events`) — cover it in the fetch branch. The
  Dashboard reads from the redux `context` slice via `useActiveTeamId`; `renderWithStore` provides the
  store, so no extra setup is needed for personal context (`activeTeamId = null`).
- **VALIDATE**: `npx jest src/screens/Dashboard --verbose`

---

### Stream C — Dense rows in Vaults & Loans

### Task 15 — ADD `showCurrency={false}` to dense list rows in Vaults and Loans

- **IMPLEMENT**: Add the prop to these `MoneyText` call sites **only**:
  - `src/screens/Vaults/ListScreen.jsx:43` (row balance) and `:51` (inline target)
  - `src/screens/Loans/ListScreen.jsx:49` (row pending), `:57` (total lent), `:58` (repaid)
  - `src/screens/Vaults/DetailScreen.jsx:193` (history row amount)
  - `src/screens/Loans/DetailScreen.jsx:198` (history row amount)
- **PATTERN**: n/a — prop additions only, no logic change.
- **GOTCHA**: **Leave the headline figures alone** — `Vaults/DetailScreen.jsx:136` (the vault balance),
  `Loans/DetailScreen.jsx:133` (pending), and every "max allowed" hint (`Vaults/DetailScreen.jsx:174`,
  `Loans/DetailScreen.jsx:179`, `Loans/NewScreen.jsx:74`) keep the symbol: those are the screen's subject
  or a value the user is about to type against, where the currency must be unambiguous. Do not touch
  `src/screens/ShoppingLists/DetailScreen.jsx` — its `formatMoney` call at `:248` is a per-item price and
  `:286` is an estimated total; both stay as-is this round.
- **VALIDATE**: `npx jest`

### Task 16 — Final integration check

- **IMPLEMENT**: Confirm `CyclingFigure` is exported from `src/components/ui/index.js`; re-run the i18n
  key-parity script from Task 4; grep for any leftover `totalCell` / `totalDivider` / `availRow` /
  `heroAvail` style definitions that no longer have consumers and delete them.
- **VALIDATE**:
  ```bash
  grep -rn "totalCell\|totalDivider\|availRow\|heroAvail" src/ || echo "clean"
  npx jest
  ```

---

## TESTING STRATEGY

Framework: **jest** with the `jest-expo` preset and **React Native Testing Library v13** (ADR-010).
Config lives in `package.json` / `jest.setup.js`. Helper: `src/test-utils/renderWithStore.jsx`.

Per memory `feedback-test-behavior-not-design`: test **functional behavior** — what renders, what a press
does, what a contract returns. **Never** assert on colors, spacing, fonts, or layout.

### Unit Tests

- `src/utils/money.test.js` — narrow-symbol path, bare-number path, nullish coercion, invalid-code
  fallback in both modes.
- `src/components/ui/MoneyText.test.jsx` — symbol present by default, absent with `showCurrency={false}`.
- `src/components/ui/CyclingFigure.test.jsx` — first step renders; press advances; wraps at the end;
  single-step list is inert-but-safe; a shrunk `steps` array clamps instead of blanking.

### Integration Tests

- `src/screens/Transactions/ListScreen.test.jsx` — default newest-first order, toggled oldest-first
  order, totals cycling through net/income/expense, and (preserved) the loan-journal exclusion from
  totals plus the existing month/year filter coverage.
- `src/screens/Dashboard/index.test.jsx` — hero cycling with and without a Lent step; vault card
  dispatches `router.navigate` with the right pathname and params.

### Edge Cases

- Empty transaction list → sort must not throw on `undefined` / `null` `rows`.
- Rows sharing an `occurred_at` → tie-break by id desc, stable in both directions.
- `occurred_at` missing/`null` on a row → `String(x ?? '')` sorts it to one end without throwing.
- `lent` transitioning `> 0 → 0` while the hero is parked on the Lent step → index clamps to a valid step.
- An invalid/unsupported currency code → `formatMoney` catch branch still returns a readable string in
  both `showCurrency` modes.
- Old ICU without `narrowSymbol` support → `RangeError` caught, degrades to `"MXN 1234.50"`.
- Repeated taps on a dashboard vault card → `navigate` updates params, never stacks duplicates.

---

## VALIDATION COMMANDS

Execute every level to ensure zero regressions.

### Level 1: Syntax & Style

```bash
npx expo-doctor
```

(There is no eslint/prettier script in `package.json` — `expo-doctor` plus the jest run is the project's
static gate.)

### Level 2: Unit Tests

```bash
npx jest src/utils src/components
```

### Level 3: Integration Tests

```bash
npx jest src/screens
npx jest            # full suite — must be green
```

### Level 4: Manual Validation

Start against the backend:

```bash
cd ../../Node/Projects/balance && NODE_ENV=stage npm start   # separate shell
APP_ENV=dev npx expo start
```

Checklist — **iOS device or simulator is required for items 5 and 6** (the reported bug is iOS-only):

1. Transactions: newest transaction is at the top on first open.
2. Transactions: tap the sort icon in the header → order reverses, icon flips (`arrow-down` ↔ `arrow-up`).
3. Transactions: totals bar shows one figure; tapping cycles Balance → Income → Expense → Balance, dots
   track the position.
4. Transactions: row amounts show no currency symbol; the totals figure does, as `$1,234.50` (not
   `MX$1,234.50`) with the backend set to MXN.
5. **iOS**: month chips render with visible labels and scroll horizontally; the year dropdown is not
   squeezed. Re-check on the narrowest device available (iPhone SE).
6. **Android**: the same row still looks correct — confirm no regression from the flex change.
7. Dashboard: hero shows Total; tapping cycles to Available and back (Lent appears only when there is an
   outstanding loan — create one to verify the 3-step cycle, then fully repay it and confirm the hero
   drops to 2 steps without breaking).
8. Dashboard: tap a vault card → the vault detail opens; **back returns to the vault list, not a dead
   end**; tap the same card again → no duplicate screen stacks.
9. Switch team context and confirm the hero accent + `primaryText` contrast still read correctly in both
   light and dark mode.

### Level 5: Additional Validation (Optional)

```bash
npx expo-modules-autolinking verify -v   # confirm no non-SDK native module crept in (Expo Go safety)
```

---

## ACCEPTANCE CRITERIA

- [ ] Transactions default to newest-first; a header icon toggles to oldest-first and back.
- [ ] Same-day transactions keep a stable relative order in both directions.
- [ ] `formatMoney` renders MXN as `$1,234.50` (narrow symbol) where a symbol is shown.
- [ ] `MoneyText showCurrency={false}` renders a bare grouped number; applied to transaction rows,
      dashboard vault rows, Vaults/Loans list rows, and vault/loan history rows.
- [ ] Headline figures (hero, detail-screen subjects, max-amount hints, transactions totals) keep a symbol.
- [ ] The Transactions totals bar shows one figure at a time and cycles Balance → Income → Expense on tap,
      with a dot indicator.
- [ ] The Dashboard hero shows one figure at a time and cycles Total → Available → Lent, skipping Lent
      when it is 0, without ever rendering a blank figure.
- [ ] Dashboard vault cards navigate to `/(tabs)/vaults/[id]` with a chevron affordance; back returns to
      the vault list and repeat taps do not stack screens.
- [ ] Month chips render with visible labels on iOS **and** Android.
- [ ] Every new user-facing string exists in both `en-US.json` and `es-MX.json`.
- [ ] `npx jest` fully green; `npx expo-doctor` clean.
- [ ] No hardcoded colors; every touched component uses `useTheme()` + `makeStyles(colors)`.
- [ ] No new `useMemo`/`useCallback` added for identity reasons (React Compiler is on).

---

## COMPLETION CHECKLIST

- [ ] Phase 1 (Tasks 1-4) complete and green **before** any Phase 2 stream starts
- [ ] Stream A, B, C completed with no file-ownership collisions
- [ ] Each task's validation command run immediately after that task
- [ ] Full test suite passes
- [ ] `expo-doctor` clean
- [ ] Manual Level 4 checklist done on **both** iOS and Android
- [ ] Acceptance criteria all met
- [ ] Dead styles removed (`totalCell`, `totalDivider`, `availRow`, `heroAvail`)

---

## NOTES

### Design decisions & trade-offs

**Shared `CyclingFigure` vs two local implementations.** The project rule is "three similar lines beat a
premature abstraction." This clears that bar: two real consumers on day one, and the shared logic
(wrap-around, index clamping against a shrinking step list, the dot indicator, a11y labelling) is
behavior worth testing once rather than twice. The purely visual differences are pushed out to props
(`labelStyle`, `valueStyle`, `dotColor`, per-step `color`), so the atom stays theme-agnostic per ADR-013.

**Sort is client-side.** `GET /transactions` accepts no sort parameter (`src/services/api/transactions.js:14`),
and the screen already filters client-side by month/year over the full cached list (ADR-015), so sorting
in the same derivation is consistent and adds no request. If the ledger ever grows past what a single
list response should carry, both the sort and the date filter move server-side together — that is a
pagination conversation, not this change.

**Why the sort control is in the header, not the filter row.** The `dateRow` is the widest row on the
screen and is the subject of the iOS collapse bug being fixed in the same pass; adding a third control
there would fight the fix. The header `right` slot already hosts one action and composes to two cleanly.

**`narrowSymbol` and disambiguation.** `narrowSymbol` renders MXN as `$`, which is ambiguous with USD in
the abstract. It is the right call here because this is a single-user app whose currency comes from
`/balance` and is constant within a context — the symbol is a formatting affordance, not an identifier.
If multi-currency ever lands, the currency belongs in the screen chrome (a header label), not repeated on
every row.

**The `unstable_settings` anchor is load-bearing.** Task 13 is not tidying — it is the other half of the
`8780c91` fix, applied preemptively to the vaults stack because Task 12 creates the same class of
cross-tab deep link that caused the original bug. Shipping Task 12 without Task 13 reintroduces a known,
already-fixed defect on a different tab.

**Not in scope this round:** sort by amount (the user chose the date-only toggle), persisting the sort
direction across app launches, and the shopping-list detail screen's money formatting.

### Repo gotcha

`.gitignore` ignores all of `.claude/`. This plan file and any new ADR must be **force-added**:

```bash
git add -f .claude/agents/plans/008-transactions-sort-currency-density.md
```

### Confidence

**8.5/10** for one-pass success. The mechanical work (props, sort, navigation) is low-risk and well
patterned. The two residual risks are (a) the iOS `ScrollView` flex fix, which cannot be verified in jest
and needs a real device check, and (b) rewriting the existing totals test at `ListScreen.test.jsx:77-87`,
whose current premise (all three figures visible at once) the cycling change deliberately invalidates —
the loan-exclusion coverage it carries must be carried forward, not dropped.
