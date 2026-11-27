# ADR-026: Android-safe drop in SortableList and device-only loan order

Status: Accepted (2026-11-26)

## Context
SortableList (ADR-024 era) cancels the layout jump at drop by writing shared values in the same JS turn
as the data reorder. Android does not commit the layout and the Reanimated writes in the same frame → a
one-frame whole-list jump. Loans now need the same reorder; BE has no generic preferences table
(`vault_order` is a dedicated table, ADR-016).

## Decision
- The drop must not rely on a frame-perfect layout/transform swap. Mechanism: `SortableList` renders rows in a
  key-stable **mounted order** (first-render order; new keys appended, removed keys dropped) so native views never
  change order on a drop/refetch. Each row's slot is only a shared-value `translateY` = (display slot top -
  mounted slot top) + drag displacement. On drop the data reorders, the row's offset changes by exactly the
  displacement it already had (set without animation, visually continuous) and the dragged row's translation is
  counter-offset by the slot delta, all on the UI thread. `zIndex` follows the `lift` shared value (set at lift,
  back to 0 when the settle animation ends), so no commit flips it. iOS feel (170ms ease-out, haptics, lift)
  unchanged. Fallback if Android still glitches: Reanimated static feature flags
  (`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`, `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`) or Reanimated >= 4.7.1.
- Edge auto-scroll (follow-up): while the finger (after moving 8px from the lift) is within 72px of the viewport top/bottom, a 16ms
  timer scrolls the ScrollView (up to 14px per 16ms, time-scaled, faster deeper in the zone, clamped to the content
  ends, never pulling back from an overscroll); the row translation and the
  drop-target math include the scrolled distance since the lift. The drop stays transform-only. Order key and
  saved-order merge are shared (`src/utils/savedOrder.js`) by vaults and loans.
- Loan order is stored on the device only (redux-persist `loanOrder`, per user+team), loans list only; unknown/new
  loans go after known ones in server order, deleted loans are dropped.
- Filter icon buttons: 2px selected border.

## Consequences
- Loan order is lost on reinstall/new device; acceptable for now.
- When a second server-synced order/preference appears, introduce a generic
  `user_sort_order(user_id, scope, item_id, position)` table and migrate `vault_order` into it, instead of a
  new table per entity.
