# ADR-028 — Android crystal card, fade reveal and personal context color

- **Status:** Accepted (amends ADR-027; BE ADR-019 personal context color)
- **Date:** 2026-11-27

## Context
On Android the glass balance card (dimezis BlurView + tint overlay + wash) read gray in both themes; iPhone looked white.
The "glass forms the letters" reveal (ghost + frost layers mounted mid-animation) glitched on both platforms.
The owner also wants to manage the Personal context color like any team.

## Decision
- **Android crystal:** no native blur on the hero card or the BalanceOptions discs. `GlassSurface` gains a `crystal` kind
  (Android, Reduce Transparency still wins with the solid card color): translucent white fill (light) / smoked fill (dark),
  card radius 24 (was 16), a 1.5px rim built from per-side border colors (accent strong on top/left, faint on
  bottom/right) plus the inner top highlight. Overdrawn (`danger`) turns the whole rim `colors.danger`.
  Per-side colors were chosen over a gradient border: RN's `BorderDrawable.drawRoundedBorders` supports per-edge colors with
  rounded corners, while a translucent fill over a gradient "rim" layer would bleed the gradient through the card.
  iOS keeps liquid glass / blur untouched.
- **Reveal:** `PressSwap` now fades + rises (`riseY`) the new side. It mounts invisible at the bottom of the press and animates
  with the card rise; no layer mounts mid-animation. `GlassTextReveal` and the ghost/blur theme keys are removed.
- **Personal color:** `GET/PATCH /users/me` (`{ id, email, color }`) via `services/api/users.js`. `useTheme` reads it with
  `useQueryState` only when `teamId == null`; the tabs layout owns the subscription. 404/error/null → `DEFAULT_ACCENT`.
  Teams list gets a Personal row → `/(tabs)/teams/personal` (color only: swatches, hex, save, "default" = null).

## Consequences
- Android look is predictable on any device/GPU, no blur cost; platforms now differ visually by design.
- The BE must be deployed for the personal color to persist; before that the app silently keeps the default accent.
- Android is verified by unit tests (Platform mocked) and the owner's APK, not on an emulator.
