# Feature: Team color + app-wide theming (dynamic accent, optional dark mode)

The following plan should be complete, but its important that you validate documentation and codebase
patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Teams gain a **color** (picked at creation, editable in Manage by an owner): a row of **10 preset
swatches** that fills a hex value, plus a **manual hex input** for custom colors. The app's theme
consumes the active context's color — switching to a team **re-tints the whole UI** (tab bar, buttons,
chips, hero card, links) with that team's color; personal context keeps the default blue. As part of
making the theme dynamic, add an **optional dark mode** (System / Light / Dark in Settings).

## User Story

As a user who belongs to several teams
I want each team to have its own color that tints the whole app while that team is active
So that I always know at a glance which context (personal or which team) I'm operating in — and I can
optionally use the app in dark mode.

## Problem Statement

1. Context confusion: personal and team contexts render identically; the only signal is a small chip
   on the Dashboard. Acting in the wrong context is easy.
2. The theme is static: `src/components/theme.js` exports a frozen `colors` object baked into
   module-level `StyleSheet.create(...)` in 21 files — nothing can re-tint, and dark mode is impossible.

## Solution Statement

- Make the palette a **function** `makeColors(scheme, accent)` and expose it through a new
  **`useTheme()` hook** (derived, not stored — same philosophy as `useActiveRole`, ADR-012): scheme
  comes from a persisted `prefs.themeMode` + `useColorScheme()`; accent comes from the active team's
  `color` in the cached `GET /teams` (personal → default).
- Migrate every consumer from `import { colors }` to `useTheme()`, converting module-level
  `StyleSheet.create` to a `makeStyles(colors)` factory called in render (React Compiler memoizes).
- New `ColorSwatchPicker` UI molecule (10 presets + hex field) used in Teams create + Manage.
- **Backend prerequisite (separate repo):** `teams.color` column + accept `color` on create/update
  (see “Backend contract change” below).

## Feature Metadata

**Feature Type**: Enhancement (+ one cross-repo contract change)
**Estimated Complexity**: Medium-High (small logic, wide migration surface)
**Primary Systems Affected**: theme tokens, all `src/components/ui/*`, all screens, tabs layout,
Settings, Teams screens, teams API, a new `prefs` slice, store persistence, i18n
**Dependencies**: none new (pure JS; `useColorScheme` is core react-native; Expo-Go-safe per ADR-003)

---

## Backend contract change (PREREQUISITE — repo `/Users/jayro/Dev/Node/Projects/balance`)

The client tolerates a missing `color` (falls back to the default accent), but the feature needs:

1. **Schema** — `src/db/schema.sql:13-20`: add `color TEXT` (nullable) to `teams`.
   Existing DBs: `ALTER TABLE teams ADD COLUMN color TEXT;` (better-sqlite3, no migration framework —
   apply manually or recreate the dev DB).
2. **Create** — `src/entities/teams/db/fields.js`: `create: ['name', 'color']`.
   `src/entities/teams/http/hooks.js` `BEFORE_CREATE`: if `body.color` present, validate
   `/^#[0-9A-Fa-f]{6}$/` else throw `{ message: 'color must be a hex value like #RRGGBB', status: 400 }`.
3. **Update** — `PUT /teams/:id` is a **custom owner-gated route** (`http/controller.js` ~line 81,
   `TeamModel.rename` in `db/model.js:30`), currently name-only and 400s without `name`. Extend it to
   accept `{ name?, color? }` (at least one), validating color as above; generalize `rename` →
   `update(teamId, { name, color })`.
4. **Read** — `GET /teams` already does `SELECT t.*, tm.role` (`db/model.js:13`) so `color` flows to
   the client with **no further change**. Response shape becomes `{ id, name, color, role, ... }`.
5. Update `docs/backend-auth-teams-contract.md` (this repo) with the new field once confirmed.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/components/theme.js` — the entire current token set (13 colors + spacing/radius/font); becomes palettes + `makeColors`.
- `src/hooks/useActiveRole.js` — Why: THE pattern for deriving state from `getTeams` cache + `activeTeamId`; `useTheme` mirrors it.
- `src/hooks/useActiveTeamId.js` — thin selector-hook pattern to mirror.
- `app/(tabs)/_layout.jsx` (lines 21-31, 36-40) — Why: `skip: !authed` pattern for `useGetTeamsQuery`, and the tab bar tint that must go dynamic.
- `app/_layout.jsx` — Why: provider stack; `<StatusBar style="dark" />` (line 42) must become theme-aware; note `Bootstrap` gates children.
- `src/reducers/context/index.js` — Why: slice shape/selector/test pattern to MIRROR for the new `prefs` slice.
- `src/store/index.js` (lines 19-34) — Why: `whitelist` must gain `'prefs'`.
- `src/services/api/teams.js` — Why: `createTeam`/`updateTeam` bodies to extend with `color`.
- `src/screens/Teams/ListScreen.jsx` (lines 21-30, 35-45, 56-61) — Why: create form to host the picker; team rows get the color dot.
- `src/screens/Teams/ManageScreen.jsx` (lines 62-70, 171-190) — Why: rename flow to extend with color editing (owner-gated).
- `src/screens/Settings/index.jsx` (lines 71-76) — Why: the language Chip row is the exact pattern for the System/Light/Dark selector.
- `src/screens/Dashboard/index.jsx` (lines 58-83, 110-114) — Why: context-switch chips (add dots) and the hero card's hardcoded `#DBEAFE`/`#FFFFFF` (fix contrast).
- `src/components/ui/Chip.jsx` — gains an optional `dot` prop; also the smallest example of the styles migration.
- `src/components/ui/Button.jsx`, `Card.jsx`, `Screen.jsx`, `Field.jsx`, `Typography.jsx`, `EmptyState.jsx`, `QueryBoundary.jsx` — all migrate to `useTheme()`.
- `src/components/ui/Chip.test.jsx`, `Button.test.jsx`, `EmptyState.test.jsx`, `MoneyText.test.jsx` — Why: bare `render(...)` breaks once components call `useTheme` (redux) — need a store wrapper.
- `src/reducers/context/index.test.js` — slice test pattern to mirror for `prefs`.
- `src/utils/money.js` + `money.test.js` — pure-util + test pattern for the new `src/utils/colors.js`.
- `src/i18n/locales/en-US.json` + `es-MX.json` — add `settings.appearance*` and `teams.color*` keys to BOTH.
- `src/reducers/auth/index.js` — `selectIsAuthed` import for the skip guard in `useTheme`.

Full migration surface (every file importing `src/components/theme`):
`src/components/ui/{Screen,Card,Button,Field,Chip,Typography,EmptyState,QueryBoundary}.jsx`,
`src/screens/Dashboard/index.jsx`, `src/screens/Transactions/{ListScreen,EditScreen,TransactionForm}.jsx`
(+ check `NewScreen`), `src/screens/Vaults/{ListScreen,NewScreen,DetailScreen}.jsx`,
`src/screens/Categories/index.jsx`, `src/screens/Settings/index.jsx`,
`src/screens/Teams/{ListScreen,ManageScreen}.jsx`, `src/screens/Login/index.jsx`,
`app/(tabs)/_layout.jsx`. (`spacing`/`radius`/`font` stay static module imports — only `colors` moves.)

### New Files to Create

- `src/utils/colors.js` — pure hex utils: `isValidHex`, `normalizeHex`, `contrastOn`.
- `src/utils/colors.test.js` — unit tests for the three.
- `src/reducers/prefs/index.js` — `prefs` slice: `{ themeMode: 'system' }` + `setThemeMode` + `selectThemeMode`.
- `src/reducers/prefs/index.test.js` — slice tests (mirror `context/index.test.js`).
- `src/hooks/useTheme.js` — THE theme seam (see Patterns).
- `src/components/ui/ColorSwatchPicker.jsx` — 10 swatches + hex field molecule (+ barrel export).
- `src/components/ui/ColorSwatchPicker.test.jsx` — behavior tests.
- `src/test-utils/renderWithStore.jsx` — RTL render wrapped in a real `configureStore` Provider.
- `.claude/ADR/ADR-013-team-color-and-theming.md` — the decision record (see Notes). Force-add:
  `.claude/` is gitignored (`git add -f`).

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [React Native — useColorScheme](https://reactnative.dev/docs/usecolorscheme)
  - Returns `'light' | 'dark' | null`; re-renders on system change. Works in Expo Go.
  - `app.config.js` already sets `userInterfaceStyle: 'automatic'` (line 16) — **do not skip this check**; without it the OS pins the app to light and `useColorScheme` never reports dark.
- [expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/)
  - `style="light" | "dark"` = the **icon** color: dark background → `light` icons.
- [Redux Toolkit createSlice](https://redux-toolkit.js.org/api/createSlice) — slice pattern (already used).
- [redux-persist whitelist](https://github.com/rt2zz/redux-persist#blacklist--whitelist) — adding a new
  key to an existing persist config merges cleanly; no version bump/migration needed.

### Patterns to Follow

**Deriving from cache, never storing (ADR-012, `src/hooks/useActiveRole.js`):**
```js
export const useActiveRole = () => {
  const teamId = useActiveTeamId();
  const { data: teams } = useGetTeamsQuery();
  if (teamId == null) return null;
  return teams?.find((team) => team.id === teamId)?.role;
};
```
`useTheme` derives the accent the same way (`team?.color`), with `skip: !authed` copied from
`app/(tabs)/_layout.jsx:23` so the Login screen never fires an unauthenticated `/teams` call.

**The styles migration (apply uniformly to all 21 files):**
```js
// BEFORE                                        // AFTER
import { colors, font, spacing } from '../theme'; import { font, spacing } from '../theme';
                                                   import { useTheme } from '../../hooks/useTheme';
const styles = StyleSheet.create({...});           const makeStyles = (colors) => StyleSheet.create({...});
export const X = () => (...)                       export const X = () => {
                                                     const { colors } = useTheme();
                                                     const styles = makeStyles(colors);
                                                     ... };
```
Minimal diff: wrap the existing sheet in `(colors) =>`, add two lines in the component. React Compiler
(enabled, `app.config.js:45`) memoizes `makeStyles(colors)` — no hand-memoization (CLAUDE.md perf rule).

**Validation at the boundary only (CLAUDE.md):** hex validation lives where the user types
(Teams create / Manage save) via `isValidHex`; everything downstream trusts a normalized `#RRGGBB`.

**Slice + selector naming:** follow `src/reducers/context/index.js` exactly (createSlice, named action
exports, `selectX` selectors, default-export reducer).

**Error surfacing:** mutations `try { await x().unwrap() } catch (e) { Alert.alert(t('common.error'), e?.message ?? '') }`
(see `ManageScreen.onRename`).

**Tests are behavior-only** (memory: never assert visual design): swatch press → `onChange` called
with the hex; invalid hex rejected at save; pure functions get direct unit tests.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — pure color logic + theme tokens
Hex utils, light/dark palettes, `makeColors(scheme, accent)`, the `prefs` slice, and `useTheme`.
Nothing visual changes yet.

### Phase 2: The migration — every consumer goes dynamic
Convert the 8 UI atoms, then screens, then `app/(tabs)/_layout.jsx` + root StatusBar, using the
makeStyles pattern. Fix the test fallout with `renderWithStore`.

### Phase 3: Feature UI — pick, persist, display
`ColorSwatchPicker`, Teams create/Manage integration, teams API `color` pass-through, Chip dots,
Settings appearance selector, i18n keys.

### Phase 4: Testing & docs
New unit/component tests, full suite green, manual two-device-scheme validation, ADR-013 +
`ARCHITECTURE.md`/`CLAUDE.md` touch-ups.

---

## STEP-BY-STEP TASKS

### CREATE src/utils/colors.js (+ colors.test.js)

- **IMPLEMENT**:
  - `isValidHex(v)` → `/^#?[0-9A-Fa-f]{6}$/.test(v ?? '')`
  - `normalizeHex(v)` → uppercase, ensure leading `#` (`'2563eb'` → `'#2563EB'`); `null` if invalid.
  - `contrastOn(hex)` → YIQ luminance `(r*299 + g*587 + b*114) / 1000`; `>= 150` → `'#16181D'` else `'#FFFFFF'`.
- **PATTERN**: pure util + colocated test, mirror `src/utils/money.js` / `money.test.js`.
- **VALIDATE**: `npx jest src/utils/colors.test.js`

### UPDATE src/components/theme.js

- **IMPLEMENT**:
  - Rename the current object to `const light = {...}` (unchanged values, minus `primary`/`primaryText` which become accent-derived).
  - Add `const dark = { bg: '#0F1115', card: '#1A1D23', text: '#F3F4F6', muted: '#9CA3AF', border: '#2A2E37', danger: '#F87171', success: '#4ADE80', incomeBg: '#14321F', incomeText: '#86EFAC', expenseBg: '#3B1519', expenseText: '#FCA5A5' }`.
  - `export const DEFAULT_ACCENT = '#2563EB';`
  - `export const PRESET_TEAM_COLORS = ['#2563EB', '#0D9488', '#16A34A', '#D97706', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#4F46E5', '#475569'];`
  - `export const makeColors = (scheme, accent) => ({ ...(scheme === 'dark' ? dark : light), primary: accent, primaryText: contrastOn(accent) })` — pure, unit-testable.
  - **REMOVE** the static `export const colors` (forces every consumer through the migration — a leftover import becomes a loud build error, not a silently-stale tint). Keep `spacing`, `radius`, `font` exports untouched.
- **IMPORTS**: `contrastOn` from `../utils/colors`.
- **VALIDATE**: `npx jest src/components` (will fail until Phase 2 lands — expected; run again after).

### CREATE src/reducers/prefs/index.js (+ index.test.js)

- **IMPLEMENT**: `initialState = { themeMode: 'system' }`; reducer `setThemeMode` (accept only
  `'system'|'light'|'dark'`, else keep state); `selectThemeMode`. NOT reset on logout (device pref, not
  session data — do not touch `Settings.onLogout`).
- **PATTERN**: `src/reducers/context/index.js` + its test.
- **VALIDATE**: `npx jest src/reducers/prefs`

### UPDATE src/store/index.js

- **ADD**: `prefs: prefsReducer` to `combineReducers`; `'prefs'` to `persistConfig.whitelist` (line 31).
- **GOTCHA**: no persist version bump needed; redux-persist merges new keys.
- **VALIDATE**: `npm test`

### CREATE src/hooks/useTheme.js

- **IMPLEMENT**:
  ```js
  import { useColorScheme } from 'react-native';
  // themeMode from prefs; authed via selectIsAuthed; teams via useGetTeamsQuery(undefined, { skip: !authed })
  const system = useColorScheme(); // 'light' | 'dark' | null
  const scheme = themeMode === 'system' ? (system ?? 'light') : themeMode;
  const team = teamId == null ? null : teams?.find((t) => t.id === teamId);
  const accent = (team?.color && isValidHex(team.color) && normalizeHex(team.color)) || DEFAULT_ACCENT;
  return { colors: makeColors(scheme, accent), scheme, accent };
  ```
- **PATTERN**: `src/hooks/useActiveRole.js` (derived, never stored); skip-guard from `app/(tabs)/_layout.jsx:23`.
- **GOTCHA**: while `getTeams` is unresolved on cold start the accent is the default for a frame or
  two — acceptable; the cache is redux-persisted so it's normally instant. Do NOT store the accent
  anywhere (same staleness argument as ADR-012's role).
- **VALIDATE**: `npm test`

### CREATE src/test-utils/renderWithStore.jsx, then UPDATE the four existing component tests

- **IMPLEMENT**: `renderWithStore(ui)` → RTL `render` with a wrapper `<Provider store={makeStore()}>`
  where `makeStore()` is a fresh `configureStore` with the real reducers (`api`, `auth`, `context`,
  `prefs`) + `baseApi.middleware` — no persistence. Re-export `screen`, `fireEvent`.
- **UPDATE**: `Chip.test.jsx`, `Button.test.jsx`, `EmptyState.test.jsx`, `MoneyText.test.jsx` (and any
  other component test that breaks) to use it. Assertions unchanged — behavior-only.
- **GOTCHA**: unauthed store → `useGetTeamsQuery` is skipped → no fetch in tests. Don't mock `useTheme`.
- **VALIDATE**: `npx jest src/components`

### UPDATE the 8 UI atoms (Screen, Card, Button, Field, Chip, Typography, EmptyState, QueryBoundary)

- **IMPLEMENT**: the makeStyles pattern (see Patterns) in each. In `Button.jsx` keep the
  variant logic; `colors.primaryText` is now contrast-correct for any accent.
- **ADD** to `Chip.jsx`: optional `dot` prop — when set, render a small `<View>` (10×10, borderRadius
  999, `backgroundColor: dot`, marginRight `spacing(0.75)`) before the label; chip becomes
  `flexDirection: 'row', alignItems: 'center'`.
- **VALIDATE**: `npx jest src/components`

### UPDATE all screens + layouts (the remaining migration surface)

- **IMPLEMENT**: same pattern in `Dashboard`, `Transactions/{ListScreen,EditScreen,TransactionForm,NewScreen?}`,
  `Vaults/{ListScreen,NewScreen,DetailScreen}`, `Categories`, `Settings`, `Teams/{ListScreen,ManageScreen}`,
  `Login`.
- **Dashboard specifics** (`src/screens/Dashboard/index.jsx:110-114`): hero card — replace hardcoded
  `'#FFFFFF'` with `colors.primaryText` and `'#DBEAFE'` with `colors.primaryText` + `opacity: 0.85`
  (readable on ANY accent, including light customs).
- **`app/(tabs)/_layout.jsx`**: `useTheme()` for `tabBarActiveTintColor: colors.primary`,
  `tabBarInactiveTintColor: colors.muted`; ADD `tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border }`
  so the tab bar follows dark mode. The whole app now re-tints on `setActiveTeam`.
- **`app/_layout.jsx`**: extract a tiny `ThemedStatusBar` (inside the Redux Provider) rendering
  `<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />` from `useTheme`; replace line 42.
- **GOTCHA**: grep for any leftover `colors` import from `../theme` when done:
  `grep -rn "colors.*from.*theme'" src app` must return nothing.
- **VALIDATE**: `npm test` + launch (`APP_ENV=dev npx expo start`) — switch teams on the Dashboard and
  watch the tint change everywhere.

### CREATE src/components/ui/ColorSwatchPicker.jsx (+ test, + barrel export)

- **IMPLEMENT**: props `{ value, onChange, label }`. A wrapping row of 10 pressable circles
  (`PRESET_TEAM_COLORS`; 32×32, borderRadius 999; selected = 2px ring in `colors.text`) — press →
  `onChange(hex)`. Below, a `Field` (label `t('teams.colorHex')`, `autoCapitalize="characters"`,
  `placeholder="#RRGGBB"`) whose text mirrors `value` and calls `onChange(text)` raw — the **consumer**
  validates at save (boundary rule). Selected swatch derives from `normalizeHex(value)`.
- **PATTERN**: one-file molecule + `index.js` barrel export, like `Chip.jsx`.
- **TESTS** (`renderWithStore`): renders 10 swatches (testID them `swatch-<hex>`), pressing one calls
  `onChange` with the hex, typing in the field calls `onChange` with the text.
- **VALIDATE**: `npx jest src/components/ui/ColorSwatchPicker.test.jsx`

### UPDATE src/services/api/teams.js

- **IMPLEMENT**: `createTeam`: `({ name, color }) => ({ ..., body: color ? { name, color } : { name } })`.
  `updateTeam`: accept `{ id, name, color }` and build the body from whichever are defined (rename-only
  and color-only saves both work). Tags unchanged (`invalidatesTags: ['Team']` already refreshes every
  consumer of `getTeams`, including `useTheme`'s accent — the re-tint after an edit is free).
- **GOTCHA**: `team_id` stays out of bodies as always; these routes are `:id`-path scoped (no `withTeam`).
- **VALIDATE**: `npx jest src/services/api` (check `endpoints.test.js` for a teams pattern to extend).

### UPDATE src/screens/Teams/ListScreen.jsx

- **IMPLEMENT**: in the create card add `<ColorSwatchPicker value={color} onChange={setColor} />`
  (state default `PRESET_TEAM_COLORS[0]`). `onCreate`: if color non-empty and `!isValidHex(color)` →
  inline `Muted` error `t('teams.invalidColor')`, abort; else `createTeam({ name, color: normalizeHex(color) })`.
  Team rows: pass `team.color` as a dot — reuse the same 10×10 dot inline before the name
  (`backgroundColor: team.color ?? colors.border`).
- **VALIDATE**: manual — create a team with a preset and with a custom hex; row shows the dot.

### UPDATE src/screens/Teams/ManageScreen.jsx

- **IMPLEMENT**: owner-only, alongside the rename flow: a `SectionTitle` `t('teams.color')` + `Card`
  with `<ColorSwatchPicker value={color} onChange={setColor} />` (state seeded from `team?.color ??
  DEFAULT_ACCENT` — sync when `team` resolves, mirroring the `setName(team?.name ?? '')` approach) and
  an `AppButton` `t('common.save')` → validate hex → `updateTeam({ id, color: normalizeHex(color) }).unwrap()`
  with the standard Alert catch.
- **GOTCHA**: if this team is the active context, the save visibly re-tints the app immediately
  (`Team` tag invalidation) — that's the desired confirmation, mention it in the manual check.
- **VALIDATE**: manual — change the active team's color; the whole UI re-tints without a restart.

### UPDATE src/screens/Dashboard/index.jsx (context chips)

- **IMPLEMENT**: team chips get `dot={team.color ?? undefined}`; the Personal chip gets
  `dot={DEFAULT_ACCENT}`.
- **VALIDATE**: manual — dots visible on the switch row.

### UPDATE src/screens/Settings/index.jsx (appearance selector)

- **IMPLEMENT**: a `SectionTitle` `t('settings.appearance')` + Chip row for
  `['system', 'light', 'dark']` — `active={themeMode === m}`, `onPress={() => dispatch(setThemeMode(m))}`,
  labels `t('settings.theme_' + m)`.
- **PATTERN**: the language Chip row directly above (`src/screens/Settings/index.jsx:71-76`).
- **VALIDATE**: manual — toggle Dark; background/cards/text flip; persists across an app restart
  (prefs slice is whitelisted).

### UPDATE src/i18n/locales/en-US.json AND es-MX.json

- **ADD** (both files, translated):
  `settings.appearance` ("Appearance"/"Apariencia"), `settings.theme_system` ("System"/"Sistema"),
  `settings.theme_light` ("Light"/"Claro"), `settings.theme_dark` ("Dark"/"Oscuro"),
  `teams.color` ("Team color"/"Color del equipo"), `teams.colorHex` ("Hex code"/"Código hex"),
  `teams.invalidColor` ("Enter a valid hex color like #2563EB"/"Ingresa un color hex válido como #2563EB").
- **VALIDATE**: switch language in Settings; no raw keys on screen.

### CREATE .claude/ADR/ADR-013-team-color-and-theming.md + docs touch-ups

- **IMPLEMENT**: record the decision — accent derived from the `getTeams` cache (never stored,
  extends ADR-012's derivation rule); `makeColors(scheme, accent)` + `useTheme()` as the single theme
  seam; `prefs` slice for `themeMode`; contrast via YIQ `contrastOn`; the backend `color` contract
  (§ above); alternatives (theme context provider — rejected: hook derivation is enough and matches
  `useActiveRole`; storing accent in the context slice — rejected: stale-copy problem, same argument
  as ADR-012). Add the index row in `.claude/ADR/README.md`. Update `ARCHITECTURE.md` §4 +
  `CLAUDE.md` key-files table (`useTheme`, `prefs`, `ColorSwatchPicker`) and
  `docs/backend-auth-teams-contract.md` (color field). **Force-add** the ADR (`git add -f .claude/ADR/...`)
  — `.claude/` is gitignored.
- **VALIDATE**: `git status` shows the ADR staged.

---

## TESTING STRATEGY

### Unit Tests
- `src/utils/colors.test.js` — valid/invalid hex (with/without `#`, wrong length, bad chars),
  normalization casing, `contrastOn` returns dark text on light accents (`#D97706`? verify by YIQ) and
  white on dark accents (`#2563EB`, `#DC2626`).
- `makeColors` — dark scheme swaps bg/text; accent lands in `primary`; `primaryText` = `contrastOn(accent)`
  (pure function — direct import, no rendering; add to `colors.test.js` or a small `theme.test.js`).
- `src/reducers/prefs/index.test.js` — default `'system'`; `setThemeMode` accepts the three values,
  ignores garbage.

### Integration Tests
- `ColorSwatchPicker.test.jsx` — swatch press and manual typing both surface through `onChange`.
- Existing suite green after the `renderWithStore` migration — that IS the regression net for the
  theme migration (components still render + fire callbacks with the dynamic theme in place).

### Edge Cases
- Custom light hex (e.g. `#FDE047`): button/hero text must stay readable → `contrastOn` picks dark text.
- Team with `color: null` (pre-existing rows): default accent, dot falls back, no crash.
- `themeMode: 'system'` with `useColorScheme() === null`: falls back to light.
- Guest role in a colored team: still re-tints (color is context, not permission).
- Active team deleted while its color is applied: tabs-layout fallback resets to personal → default
  accent (existing `app/(tabs)/_layout.jsx:27-31` effect covers it — verify manually).

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```bash
grep -rn "colors.*from.*['\"].*theme['\"]" src app   # must be EMPTY (no stale static imports)
npx expo-doctor
```

### Level 2: Unit Tests
```bash
npx jest src/utils/colors.test.js src/reducers/prefs src/components/ui/ColorSwatchPicker.test.jsx
```

### Level 3: Full suite
```bash
npm test
```

### Level 4: Manual Validation (backend running: `cd ../../Node/Projects/balance && NODE_ENV=stage npm start`)
1. `APP_ENV=dev npx expo start` → login.
2. Teams tab → create a team, pick a preset swatch → row shows the dot.
3. Dashboard → switch to that team → tab bar, chips, hero, buttons re-tint; switch to Personal → blue.
4. Manage the active team → set a custom hex (try a light one, e.g. `FDE047`) → app re-tints on save,
   button text stays readable; try `xyz` → inline invalid-hex error.
5. Settings → Appearance → Dark → dark surfaces everywhere incl. tab bar; kill + relaunch → still dark.
6. Set System + flip the OS scheme → app follows live.
7. `curl -s -H "Authorization: Bearer $TOKEN" $API_URL/teams | jq '.[0].color'` → the saved hex.

### Level 5: Additional (optional)
`npx expo-modules-autolinking verify -v` — still Expo-Go-safe (no new native modules).

---

## ACCEPTANCE CRITERIA

- [ ] Team create + Manage (owner) offer 10 preset swatches AND manual hex entry; invalid hex is
      rejected inline at save.
- [ ] Switching context re-tints the entire app (tab bar, chips, buttons, hero) to the team color;
      personal = default blue; color edits re-tint live.
- [ ] Settings has System/Light/Dark; dark mode themes all screens; preference survives restart.
- [ ] Text on the accent stays readable for any hex (contrastOn).
- [ ] No file imports a static `colors` from the theme module.
- [ ] Full jest suite passes; new units for colors utils, prefs slice, ColorSwatchPicker.
- [ ] Backend accepts/returns `color` per the contract section (separate repo, prerequisite).
- [ ] ADR-013 written + force-added; ARCHITECTURE.md/CLAUDE.md/contract doc updated.

## COMPLETION CHECKLIST

- [ ] All tasks completed in order, each validation run immediately
- [ ] `npm test` fully green (including migrated component tests)
- [ ] Manual validation levels 4.1–4.7 confirmed on device/simulator
- [ ] Grep for stale theme imports returns nothing
- [ ] Conventional commits: backend change (`feat:` in balance repo) separate from the client work;
      client work can split `refactor: dynamic theme seam` + `feat: team color + dark mode`

## NOTES

- **Order matters:** land the backend contract first (or in parallel) — the client tolerates a missing
  `color`, so the mobile work is testable either way, but Level-4 validation needs the real field.
- **Why no ThemeProvider/context:** `useTheme()` derives everything from existing sources (redux prefs,
  RTK Query cache, `useColorScheme`) — a provider would add plumbing without adding a source of truth;
  this mirrors how `useActiveRole` avoided storing the role (ADR-012). React Compiler handles the
  re-render cost. If profiling ever says otherwise, a context wrapper can be added behind the same
  `useTheme()` signature without touching consumers.
- **Why remove the static `colors` export:** any straggler import keeps rendering stale light-mode
  colors silently; a hard build error during the migration is the safety net.
- **`primaryText` is now derived** — the Button/Chip/hero all assumed white-on-blue; `contrastOn`
  keeps them legible on user-chosen accents. Don't skip the Dashboard hero hardcodes.
- **Scope guard:** no per-category colors, no theme animation/transition, no MMKV move — out of scope.
