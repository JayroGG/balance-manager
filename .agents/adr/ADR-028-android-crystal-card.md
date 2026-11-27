# ADR-028 — Android crystal card, fade reveal and personal context color

- **Status:** Accepted (amends ADR-027; BE ADR-019 personal context color)
- **Date:** 2026-11-27

## Context
On Android the glass balance card (dimezis BlurView + tint overlay + wash) read gray in both themes; iPhone looked white.
The "glass forms the letters" reveal (ghost + frost layers mounted mid-animation) glitched on both platforms.
The owner also wants to manage the Personal context color like any team.

## Decision
- **Android crystal:** no native blur on the hero card or the BalanceOptions discs. `GlassSurface` gains a `crystal` kind
  (Android; Reduce Transparency still wins with the solid card color), rendered by `CrystalSurface`. Only the EDGE is glass:
  the body is calm (near-white / smoked, no gradient, inset 1px top highlight), card radius 24 (was 16), and the rim is a 1.5px
  diagonal sheen (`experimental_backgroundImage` linear-gradient behind an inset body: accent at the top-left, a white glint in
  the middle, fading out bottom-right, low alpha) with a faint outer accent `boxShadow` glow. Overdrawn (`danger`) turns the
  sheen and glow danger. iOS keeps liquid glass / blur untouched.
  Round 1 used per-side border colors (read as a solid colored border on device: too hard); round 2 replaced it.
  Libraries considered for round 2: `@shopify/react-native-skia` (gradient/sweep strokes, BlurMask glow; but a large native
  dep: prebuild + iOS dev-client rebuild + APK size, for what RN 0.85's own gradient/boxShadow/inset-shadow already give),
  `expo-linear-gradient` + masked view (extra native deps for the same ring), `react-native-linear-gradient` (no New
  Architecture support), `react-native-gradient-border` (wraps masked-view + linear-gradient). No new dependency was chosen.
- **Reveal:** `PressSwap` now fades + rises (`riseY`) the new side. It mounts invisible at the bottom of the press and animates
  with the card rise; no layer mounts mid-animation. `GlassTextReveal` and the ghost/blur theme keys are removed.
- **Personal color:** `GET/PATCH /users/me` (`{ id, email, color }`) via `services/api/users.js`. `useTheme` reads it with
  `useQueryState` only when `teamId == null`; the tabs layout owns the subscription. 404/error/null → `DEFAULT_ACCENT`.
  Teams list gets a Personal row → `/(tabs)/teams/personal` (color only: swatches, hex, save, "default" = null).

## Consequences
- Android look is predictable on any device/GPU, no blur cost; platforms now differ visually by design.
- The BE must be deployed for the personal color to persist; before that the app silently keeps the default accent.
- Android is verified by unit tests (Platform mocked) and the owner's APK, not on an emulator.
