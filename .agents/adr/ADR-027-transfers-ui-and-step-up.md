# ADR-027 — Transfers UI, step-up prompt and admin permissions

- **Status:** Accepted (FE `balance-manager`; BE ADR-017 / ADR-018)
- **Date:** 2026-11-27

## Context
BE adds owner-only inter-context transfers guarded by a server step-up permit. The app also showed a
global admin as read-only inside teams (role 'admin' unknown to `src/permissions`).

## Decision
- **Entry:** the Dashboard balance card flips (tap) to a glass options menu whose **Transfer** tile opens the flow (the old text link is removed). The tile is enabled only when the caller owns the current context
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
- **Balance card flip + glass (addendum):** reusable pieces in one place — `src/components/motion/FlipCard3D.jsx`
  (springy rotateY, squash/stretch, perspective, shifting layered `boxShadow`, haptic; Reduce Motion ->
  crossfade), `src/components/glass/GlassSurface.jsx` (`expo-glass-effect` liquid glass on iOS 26+, `expo-blur`
  elsewhere, solid under Reduce Transparency) and `src/theme/motion.js` (spring presets, timings, shadow depth,
  haptic helper). The card flips back after a pick, on context switch and when leaving the screen.
- **Round 2 (owner feedback):** `FlipCard3D` is gesture-driven: a pan rotates it live around Y (small X tilt) and
  on release it snaps to the nearest face with the underdamped `springs.magnetic` (release velocity clamped so the
  wobble never shows the wrong face); a tap still flips; Reduce Motion disables the pan (crossfade only). Both faces
  share one layout box; squash 0.02, perspective 1600. The back grid fills the face (2x2, equal cells; gutters sit
  OUTSIDE the tile Pressables) and a tap anywhere outside a tile flips back. Whole-element touch: the front content is
  non-interactive inside one face `Pressable`; Chip min height 44.
- **Glass (round 2b, supersedes accent-tinted card):** the accent moves OUT of the card into a pastel scene behind it
  (`GlassBackdrop`: blurry radial blobs from `pastelPalette(accent)` plus a few crisp shapes so the blur is visibly
  doing something). The card is near-transparent white frosted glass (`GlassSurface`: white wash, thin light rim, top
  highlight, ink = `colors.text`). A native blur/glass under a 3D rotation darkens/glitches, so the real blur is ONE
  static `GlassFill` underlay (`FlipCard3D underlay`, only narrows with |cos| like the shadow) and the rotating faces and
  tiles are `flat` (wash only).
- **Glass paths:** Reduce Transparency -> opaque card color. Otherwise the underlay is `expo-blur` BlurView: iOS
  UIVisualEffect; Android real blur through `BlurTargetView` (dimezis); Expo Go bundles expo-blur, so it takes the
  BlurView path. A dev client built BEFORE expo-blur was added has no `ExpoBlur` native module
  (`requireOptionalNativeModule`): the card silently degrades to a translucent wash and logs a dev warning ("rebuild the
  dev client"). Liquid glass (`GlassView`, iOS 26+) is only used by non-rotating `GlassSurface` uses.
- **A11y:** the back face is not one accessible element (tiles stay individually reachable); VoiceOver flips back with the
  two-finger escape gesture (iOS only; TalkBack has no flip-back gesture — the user can switch context or leave the screen).
- **Libraries:** `expo-glass-effect` + `expo-blur` (SDK 56 pinned, owner-approved). Native modules: dev builds/APKs
  need a rebuild; Expo Go works.

## Consequences
- Biometric step-up reuses the stored-credential trade-off accepted in ADR-024.
- New screen + modal; two new native deps (glass/blur), rebuild dev clients.
- Tests mock reanimated through `src/test-utils/reanimatedMock.js`.
