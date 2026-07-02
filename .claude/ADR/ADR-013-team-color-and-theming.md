# ADR-013 — Team color as the app accent, dynamic theming, and dark mode

- **Status:** Accepted
- **Date:** 2026-07-02
- **Deciders:** Jayro Gómez
- **Supersedes / Related:** Extends **ADR-011** (team context) and **ADR-012** (derive-don't-store
  rule). Builds on ADR-005 (RTK Query cache as the single source), ADR-007 (persisted prefs ride
  redux-persist), ADR-008 (ui atoms), ADR-010 (behaviour-only tests). Backend counterpart: `teams.color`
  (`docs/backend-team-color-request.md` → backend's `react-native-team-color-update.md`).

## Context

Personal and team contexts rendered identically — the only signal was a small chip on the Dashboard,
so acting in the wrong context was easy. Separately, the theme was frozen: `src/components/theme.js`
exported a static `colors` object baked into module-level `StyleSheet.create` in 21 files, making both
per-team accents and dark mode impossible.

The backend added a nullable `teams.color` (`#RRGGBB`, normalized uppercase; accepted on
`POST /teams` and `PUT /teams/:id` — `color: null` clears; returned by `GET /teams`).

## Decision

1. **Palette becomes a pure function.** `makeColors(scheme, accent)` in `src/components/theme.js`
   spreads a `light`/`dark` surface palette and derives `primary` (the accent) + `primaryText`
   (via a YIQ `contrastOn(hex)` in `src/utils/colors.js`, so any custom hex keeps text readable).
   There is **no static `colors` export** — a stale import is a build error, not a silently wrong tint.
2. **One theme seam: `useTheme()`** (`src/hooks/useTheme.js`) — everything derived, nothing stored
   (ADR-012's rule applied to theming):
   - **scheme** ← persisted `prefs.themeMode` (`'system' | 'light' | 'dark'`; system follows
     `useColorScheme()`; `app.config.js` already had `userInterfaceStyle: 'automatic'`).
   - **accent** ← the active team's `color` from the **cached `GET /teams`** + `activeTeamId`;
     personal (`null`) or colorless team → `DEFAULT_ACCENT`. Pre-auth the query is skipped
     (`skip: !authed`) so Login themes without firing an unauthenticated call.
   - Because team mutations invalidate the `Team` tag, saving a color **re-tints the app live** for free.
3. **`prefs` slice** (`src/reducers/prefs/`) holds `themeMode`; persisted via the redux-persist
   whitelist; deliberately **not reset on logout** (device pref, not session data).
4. **Consumers migrate mechanically:** module `StyleSheet.create({...})` →
   `const makeStyles = (colors) => StyleSheet.create({...})` called in render (React Compiler
   memoizes; no hand-memoization). Applied to all 8 ui atoms, every screen, the tab bar
   (`tabBarStyle` now follows the scheme), and a `ThemedStatusBar` in the root layout.
5. **Picker UI:** `ColorSwatchPicker` (ui molecule) — the 10 `PRESET_TEAM_COLORS` swatches fill a hex
   field that also accepts a custom hex; emits raw text, consumers validate at save
   (`isValidHex`/`normalizeHex`, boundary rule). Used on Teams create and the owner's Manage screen.
   `Chip` gained a `dot` prop so the Dashboard context switch and Teams list preview each team's color.
6. **Tests:** pure units for `colors`/`makeColors`/`prefs`; behaviour tests for the picker; a
   `renderWithStore` helper (`src/test-utils/`) wraps component tests now that atoms read redux.

## Consequences

- **Positive:** context is now unmistakable — the whole UI (tab bar, buttons, chips, heroes) carries
  the active team's color; personal stays default-blue. Dark mode falls out of the same rework at
  near-zero marginal cost. Still Expo-Go-safe: zero new dependencies.
- **Positive:** one seam (`useTheme`) means future theming work (high-contrast, per-vault tints,
  MMKV-backed prefs) attaches in one place.
- **Negative / trade-offs:** every themed component calls `useTheme()` (a selector + cache read per
  render — React Compiler absorbs it; a context provider can be slotted behind the same signature if
  profiling ever demands). Hardcoded hero tints (`#DBEAFE`/`#FFFFFF`) were replaced by
  `primaryText`-derived styles. Cold start may paint the default accent for a frame until the
  persisted `getTeams` cache rehydrates.
- **Follow-ups:** none blocking. North star ideas: transfer the accent into the Android adaptive-icon
  / splash theming at prebuild time; theme-aware charts (Phase 4).

## Alternatives considered

- **Store the accent (or role+color) in the `context` slice.** Rejected — same stale-copy argument as
  ADR-012: the `getTeams` cache is already the source of truth and refreshes on every `Team`
  invalidation.
- **A React ThemeProvider/context.** Rejected for now — it adds plumbing without adding a source of
  truth; `useTheme()` derives from existing stores and the signature hides where values come from, so
  a provider can be introduced later without touching consumers.
- **Keep the static `colors` export as light-mode fallback during migration.** Rejected — stragglers
  would render stale colors silently; a hard build error is the safety net.
- **Only re-tint an app-bar/badge instead of the full theme.** Rejected — the ask is that a context
  switch be unmistakable; a whole-surface accent achieves that and costs the same once the seam exists.
