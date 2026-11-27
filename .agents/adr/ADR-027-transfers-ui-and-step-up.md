# ADR-027 — Transfers UI, step-up prompt and admin permissions

- **Status:** Accepted (FE `balance-manager`; BE ADR-017 / ADR-018)
- **Date:** 2026-11-27

## Context
BE adds owner-only inter-context transfers guarded by a server step-up permit. The app also showed a
global admin as read-only inside teams (role 'admin' unknown to `src/permissions`).

## Decision
- **Entry:** pressing the Dashboard balance card swaps it to a back face whose centred **Transfer** control opens the flow (the old text link is removed). It is enabled only when the caller owns the current context
  (personal counts) and at least one other (real role from `GET /teams`, not 'admin').
- **Flow:** destination (owned contexts except current) -> amount -> if short, manual vault split
  (source vaults with balances; confirm only when parts == shortfall exactly) -> note + date (default
  today) -> confirm summary -> step-up -> success toast; stay in source; balances, transactions, vaults
  and activity refetch for both contexts.
- **Step-up:** biometric enabled -> `expo-local-authentication` -> stored creds -> `POST /auth/step-up`;
  disabled, cancelled or failed -> email + password modal. The permit goes to that single request and is
  never stored. Same prompt before reverting a transfer.
- **Rows:** transfer rows read "Transfer from/to {counterpart_label}"; reversal rows read "Devolución
  from/to {counterpart_label}". Detail is read-only with "Revert" for an owner of both sides (once;
  not on a reversal); a reverted transfer shows "Reverted" and links to its reversal.
- **Admin:** a global admin (JWT `role` claim -> `auth.user.isAdmin`) gets owner affordances (`canAdd`,
  `canEditRow`, `canManageTeam`) in EVERY team, even where the real membership role is member/guest
  (`usePermissions`); role 'admin' from `GET /teams` is treated the same. Transfers still follow real
  ownership (`useOwnedContexts`). UI only — the API enforces.
- **Balance card press-swap + glass (rounds 1-3; the 3D flip was dropped in round 3):** reusable pieces in one place —
  `src/components/motion/PressSwap.jsx` (generic: front/back render props, controlled `side`), `src/components/glass/*`
  (`GlassSurface`, `GlassFill`, `GlassBackdrop`, `glassSupport`) and `src/theme/motion.js` (timings, shadow depth, haptic).
  Pressing sinks the card (down 5pt, scale 0.96, shadow tightens) while its content softens to a floor opacity (never
  blank; a real blur on Android, iOS has no style blur); the content swaps at the BOTTOM of the press, then the card
  rises on release with a smooth ease and the new content fades in. Every phase has a minimum duration (sink 120ms, hold
  80ms, rise 300ms) so a quick tap plays the whole sequence; presses during a sequence are ignored (no queue, no flicker);
  a press that becomes a scroll/cancel rises without swapping. Reduce Motion: no sink, a short crossfade. Outside side
  changes (context switch, leaving the screen, a tile action) crossfade. The card returns to the front after a tile pick, on context
  switch and when leaving the screen. The back shows ONLY Transfer: a small glass disc (icon only, soft lift shadow) in the first slot (top-left, on the card padding, room for future actions
  beside it) with a plain label under it carrying a matching text shadow, no box. Two dimmed 'Soon' placeholder slots sit beside it,
  the three spread evenly; placeholders are plain Views with `pointerEvents='none'` (never Pressables), so a tap on them
  swaps the card back. Nothing else on the back is pressable, so a tap anywhere else swaps back. Whole-card touch (front content is
  non-interactive inside one Pressable). Any other screen's tappable card must make the CONTAINER the Pressable
  (`CyclingFigure` `style`/`trailing`): the Transactions totals bar only responded on its text because the Pressable was a
  shrink-wrapped child of a padded View.
  Release order gotcha: Pressability fires `onPressOut` BEFORE `onPress`, so after a long hold the rise must wait for the
  swapped side to render (`ownSwap`, `swapWaitMs`), else the reveal setup lands after the rise and the card ends blank.
- **Glass:** the card is near-transparent frosted white (`GlassSurface`: white wash, thin light rim, top highlight, ink
  `colors.text`) over a `GlassFill` blur layer; the accent lives only in a single soft, low-saturation glow behind it
  (`GlassBackdrop`). Paths: Reduce Transparency -> opaque card color; otherwise `expo-blur` BlurView (iOS UIVisualEffect;
  Android real blur through `BlurTargetView`; Expo Go bundles expo-blur). A dev client built BEFORE expo-blur has no
  `ExpoBlur` native module (`requireOptionalNativeModule`): the card degrades to a translucent wash and logs a dev warning
  ("rebuild the dev client").
- **Reveal (round 3b):** `GlassTextReveal` (inside `PressSwap`) layers, while the new side forms: a blurred GHOST of the same
  tree (soft smudges where the text will be; hidden from a11y/queries), a frost over it (iOS: an opaque `BlurView`;
  Android: a real `filter: blur` on the ghost) and the REAL content on top; the real text sharpens in over the ghost while
  the ghost dissolves, finishing with the rise. Needs a native blur (iOS `ExpoBlur` / Android) — otherwise a plain fade.
  Not built: a water-like ripple of the template (cost/jank risk on device).
- **Layout gotcha:** RN 0.85 removed `StyleSheet.absoluteFillObject`; spreading it silently gives nothing, so the options
  face collapsed to ~0 height and every row overlapped (jest could not see it). A jest guard now bans it; verify layout on
  the simulator, not only in jest.
- **A11y:** the front is one button (expanded state); on the back the card is NOT a group, so the Transfer control is
  reachable (its disabled reason is its hint) and the front is hidden from screen readers; VoiceOver's two-finger escape swaps back (iOS only — TalkBack has
  no swap-back gesture; switching context or leaving the screen also resets).
- **Hit areas:** `Chip` min height 44; the whole visual element is the target.
- **Libraries:** `expo-glass-effect` + `expo-blur` (SDK 56 pinned, owner-approved). Native modules: dev builds/APKs
  need a rebuild; Expo Go works.

## Consequences
- Biometric step-up reuses the stored-credential trade-off accepted in ADR-024.
- New screen + modal; two new native deps (glass/blur), rebuild dev clients.
- Tests mock reanimated through `src/test-utils/reanimatedMock.js`.
