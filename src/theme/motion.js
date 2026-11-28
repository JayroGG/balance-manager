import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Single home for the motion language (ADR-027): press-swap timings, shadow depth, and the haptic tap.
// Components import from here — nothing animation-specific is inlined in screens.

// Press-swap (PressSwap): press sinks the card and fades its content, the content swaps at the bottom, release
// rises smoothly. Every phase has a MINIMUM duration so even a quick tap plays the whole sequence.
export const pressSwap = {
  sinkMs: 120, // down + content fade-out (min)
  holdMs: 80, // at the bottom, after the swap (min)
  swapWaitMs: 300, // max wait for the parent to render the swapped side before rising anyway
  riseMs: 300, // smooth ease back up + content fade-in
  sinkY: 5, // pt the card moves down
  sinkScale: 0.96,
  fadeFloor: 0.28, // outgoing content softens to this opacity, never to blank
  riseY: 8, // pt the new content rises from while it fades in
  crossfadeMs: 160, // Reduce Motion and external swaps: no sink, just fade out/in
};

// Layered shadow per depth: resting vs pressed (tighter, closer to the surface).
export const depth = {
  rest: { y: 5, blur: 14, alpha: 0.14 },
  pressed: { y: 1, blur: 3, alpha: 0.22 },
};

// Haptics (ADR-028): short and light everywhere. Android uses the platform's own light effects
// (performAndroidHapticsAsync: a crisp tick, not the long motor buzz of impactAsync); iOS uses the Light/Soft impacts.
//   tap  — press down on the swap card     (Android Context_Click, iOS Light)
//   lift — a drag arms after the long-press (Android Gesture_Start, iOS Light)
//   drop — the drag settled                (Android Gesture_End,   iOS Soft)
const play = (androidType, iosStyle) => {
  const impact = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.[iosStyle]);
  try {
    if (Platform.OS === 'android' && Haptics.performAndroidHapticsAsync && Haptics.AndroidHaptics) {
      // Gesture_Start/End need API 30+: an older device rejects, so fall back to a light impact
      Promise.resolve(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics[androidType])).catch(() =>
        Promise.resolve(impact()).catch(() => {}),
      );
    } else {
      Promise.resolve(impact()).catch(() => {});
    }
  } catch {
    /* haptics unavailable (simulator/web) */
  }
};
export const tapHaptic = () => play('Context_Click', 'Light');
export const liftHaptic = () => play('Gesture_Start', 'Light');
export const dropHaptic = () => play('Gesture_End', 'Soft');
