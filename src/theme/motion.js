import * as Haptics from 'expo-haptics';

// Single home for the "toony" motion language (ADR-027): spring presets, flip timings, 3D shadow depth
// levels and the haptic tap. Components import from here — nothing animation-specific is inlined in screens.

// Springy with a visible overshoot (low damping) — the flip lands, wobbles, settles.
export const springs = {
  toony: { damping: 11, stiffness: 170, mass: 0.9 },
  settle: { damping: 18, stiffness: 220, mass: 0.8 },
};

export const flip = {
  perspective: 900,
  squash: 0.06, // peak scale change mid-flip (stretch up, squash back)
  reducedMs: 160, // Reduce Motion: short crossfade instead of the spring
};

// Layered boxShadow per depth: resting vs lifted off the screen. `shift` is multiplied by sin(rotation)
// so the shadow slides sideways as the card turns.
export const depth = {
  rest: { y: 4, blur: 10, alpha: 0.14 },
  lifted: { y: 14, blur: 26, alpha: 0.3, shift: 18 },
};

export const tapHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* haptics unavailable (simulator/web) */
  }
};
