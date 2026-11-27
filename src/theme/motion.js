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

export const tapHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* haptics unavailable (simulator/web) */
  }
};
