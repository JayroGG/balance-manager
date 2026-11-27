import * as Haptics from 'expo-haptics';

// Single home for the "toony" motion language (ADR-027): spring presets, flip timings, 3D shadow depth
// levels and the haptic tap. Components import from here — nothing animation-specific is inlined in screens.

// Springy with a visible overshoot (low damping) — the flip lands, wobbles, settles.
export const springs = {
  toony: { damping: 11, stiffness: 170, mass: 0.9 },
  settle: { damping: 18, stiffness: 220, mass: 0.8 },
  // Release snap of the draggable card: clearly underdamped so it wobbles around the face before it settles.
  magnetic: { damping: 12, stiffness: 130, mass: 1 },
};

export const flip = {
  perspective: 1600, // long lens: the card must not balloon toward the camera mid-flip
  squash: 0.02, // peak scale change mid-flip — subtle, never a visible grow
  grabScale: 0.015, // extra lift while a finger holds the card
  dragSpan: 0.9, // fraction of the card width that is one full flip
  tiltMax: 8, // deg of X tilt following the finger
  maxVelocity: 2.5, // cap (cards/sec) on the release velocity fed to the snap spring: the wobble can't swing past the other face
  throw: 0.25, // how far release velocity projects the card before it picks a face
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
