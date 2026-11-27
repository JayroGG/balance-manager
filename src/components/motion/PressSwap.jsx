import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { depth, pressSwap as T, tapHaptic } from '../../theme/motion';
import { nativeBlurAvailable } from '../glass/glassSupport';
import { GlassTextReveal } from './GlassTextReveal';

// Generic "press the card, its content swaps" (ADR-027). Pressing sinks the card like a physical button (down a few
// pt + scale, shadow tightens) while its content fades out; at the BOTTOM of the press the content swaps to the other
// side; on release the card rises with a smooth ease and the new content fades in. Knows nothing about its content.
//   front / back  render props. The front sizes the box; the back fills it (and only mounts while shown).
//   side          'front' | 'back', controlled. The swap asks `onSwap(next)` at the bottom of a press.
//   frostTint     'light' | 'dark' for the iOS frost of the reveal
//   Surface       optional STABLE component wrapping the content (the glass frame); gets {...surfaceProps, style, children}
// The new side is revealed as if the glass formed it (GlassTextReveal): a blurred ghost template (soft smudges where
// the text will be), the real text sharpening in on top, the template dissolving as the card finishes rising.
// Timings have MINIMUM durations (theme/motion.js `pressSwap`): a quick tap still plays sink -> hold -> rise as one
// motion; holding keeps the card down until release. A press while the sequence runs is ignored (no queue, no
// flicker). A press that turns into a scroll/cancel rises back WITHOUT swapping. Reduce Motion: no sink, a crossfade.
// The outgoing content never goes blank: it softens to a floor (`fadeFloor`; real blur on Android) so there is
// always something blurry to see, then the new side fades in.
// A `side` change from outside (context switch, a tile action) crossfades.
export const PressSwap = ({ side, onSwap, front, back, Surface = View, surfaceProps, frostTint, style, testID, radius = 16 }) => {
  const reduce = useReducedMotion();
  const sink = useSharedValue(0); // 0 rest .. 1 pressed
  const fade = useSharedValue(1); // content opacity
  const ghostOp = useSharedValue(0); // the blurred template's opacity
  const ghostBlur = useSharedValue(T.ghostBlurFrom);
  const realOp = useSharedValue(1); // the real text's opacity while it sharpens in
  const [ghosting, setGhosting] = useState(false);
  const [shown, setShown] = useState(side);
  const phase = useRef('idle'); // idle | sinking | down | rising
  const st = useRef({ pressed: false, tapped: false, swapped: false, t0: 0 });
  const timers = useRef([]);
  const ownSwap = useRef(null); // the side our own swap is waiting for (null = none)
  const revealing = useRef(false);
  // The glass-forms-the-letters reveal needs a native blur (iOS BlurView) or Android's style blur; else plain fade.
  const canReveal = !reduce && (Platform.OS === 'android' || nativeBlurAvailable());
  const sideRef = useRef(side);
  sideRef.current = side;

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const rise = () => {
    phase.current = 'rising';
    const ease = Easing.out(Easing.cubic);
    sink.value = withTiming(0, { duration: T.riseMs, easing: ease });
    if (revealing.current) {
      // the reveal finishes together with the rise: real text sharpens in, the template dissolves with more blur
      realOp.value = withDelay(T.realDelayMs, withTiming(1, { duration: T.riseMs - T.realDelayMs, easing: ease }));
      ghostOp.value = withTiming(0, { duration: T.riseMs, easing: ease });
      ghostBlur.value = withTiming(T.ghostBlurTo, { duration: T.riseMs, easing: ease });
    } else {
      fade.value = withTiming(1, { duration: T.riseMs, easing: ease });
    }
    later(() => {
      phase.current = 'idle';
      if (revealing.current) {
        revealing.current = false;
        setGhosting(false);
      }
    }, T.riseMs);
  };

  // Rise once released AND the swap happened AND the minimum sink+hold time has passed.
  const tryRise = () => {
    const s = st.current;
    if (phase.current !== 'down' || s.pressed) return;
    const wait = s.t0 + T.sinkMs + T.holdMs - Date.now();
    if (wait > 0) later(tryRise, wait);
    else rise();
  };

  const doSwap = () => {
    const next = sideRef.current === 'front' ? 'back' : 'front';
    st.current.swapped = true;
    ownSwap.current = next; // the side change we expect back: show it now, while the card is down
    onSwap?.(next);
  };

  // The bottom of the press. A tap (finger already up) swaps now; a finger still down waits at the bottom and swaps
  // on release (onPress); a press that ends with no tap is a cancel (a scroll took the touch): rise, no swap.
  const atBottom = () => {
    const s = st.current;
    phase.current = 'down';
    if (s.tapped) {
      doSwap();
      tryRise();
    } else if (!s.pressed) rise();
  };

  const onPressIn = () => {
    if (reduce || phase.current !== 'idle') return;
    phase.current = 'sinking';
    st.current = { pressed: true, tapped: false, swapped: false, t0: Date.now() };
    tapHaptic();
    sink.value = withTiming(1, { duration: T.sinkMs, easing: Easing.out(Easing.quad) });
    fade.value = withTiming(T.fadeFloor, { duration: T.sinkMs });
    later(atBottom, T.sinkMs);
  };

  const onPress = () => {
    if (reduce) {
      tapHaptic();
      onSwap?.(side === 'front' ? 'back' : 'front'); // an outside-style swap: crossfades below
      return;
    }
    st.current.tapped = true;
    if (phase.current === 'down' && !st.current.swapped) {
      doSwap(); // released after reaching the bottom
      tryRise();
    }
  };

  const onPressOut = () => {
    st.current.pressed = false;
    // after onPress had its chance to mark the tap: rise, or cancel if the press never became a tap
    later(() => {
      const s = st.current;
      if (phase.current === 'down' && !s.swapped && !s.tapped) rise();
      else tryRise();
    }, 0);
  };

  // Side changes: our own swap lands while the card is down (just show it). Anything else crossfades.
  useEffect(() => {
    if (shown === side) return;
    if (ownSwap.current === side) {
      ownSwap.current = null;
      setShown(side);
      if (canReveal) {
        // The new side's template forms at the bottom; the real text stays invisible until the rise.
        revealing.current = true;
        fade.value = 1;
        realOp.value = 0;
        ghostBlur.value = T.ghostBlurFrom;
        ghostOp.value = withTiming(T.ghostOpacity, { duration: T.ghostInMs });
        setGhosting(true);
      }
      return;
    }
    ownSwap.current = null;
    if (revealing.current) {
      // an outside change landed mid-reveal (e.g. a tile tap while rising): drop the template at once
      revealing.current = false;
      setGhosting(false);
      ghostOp.value = 0;
      realOp.value = 1;
    }
    fade.value = withTiming(T.fadeFloor, { duration: T.crossfadeMs / 2 });
    later(() => {
      setShown(side);
      fade.value = withTiming(1, { duration: T.crossfadeMs / 2 });
    }, T.crossfadeMs / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const card = useAnimatedStyle(() => {
    const s = reduce ? 0 : sink.value;
    return {
      transform: [{ translateY: s * T.sinkY }, { scale: 1 - (1 - T.sinkScale) * s }],
      boxShadow: [
        {
          offsetX: 0,
          offsetY: depth.rest.y + (depth.pressed.y - depth.rest.y) * s,
          blurRadius: depth.rest.blur + (depth.pressed.blur - depth.rest.blur) * s,
          color: `rgba(0,0,0,${(depth.rest.alpha + (depth.pressed.alpha - depth.rest.alpha) * s).toFixed(3)})`,
        },
      ],
    };
  });
  // The content softens as it fades: it also shrinks a touch (a cheap "blur-out" without a native blur).
  const content = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 0.97 + 0.03 * fade.value }],
    // Android can really blur a view; iOS has no style blur, so it relies on the soft fade + shrink.
    ...(Platform.OS === 'android' ? { filter: [{ blur: (1 - fade.value) * T.blurMax }] } : null),
  }));

  const isFront = shown === 'front';
  return (
    <Animated.View testID={testID} style={[{ borderRadius: radius }, card, style]}>
      <Pressable
        testID={testID && `${testID}-press`}
        onPressIn={onPressIn}
        onPress={onPress}
        onPressOut={onPressOut}
        // Front: the card is ONE button. Back: not a group, so every tile stays reachable by a screen reader;
        // the two-finger escape (VoiceOver) swaps back.
        accessible={isFront}
        accessibilityRole={isFront ? 'button' : undefined}
        accessibilityState={{ expanded: side === 'back' }}
        onAccessibilityEscape={isFront ? undefined : () => onSwap?.('front')}
      >
        <Surface {...surfaceProps} style={{ borderRadius: radius }}>
          <Animated.View style={content} pointerEvents="none">
            <View
              style={isFront ? null : styles.hidden}
              accessibilityElementsHidden={!isFront}
              importantForAccessibility={isFront ? 'auto' : 'no-hide-descendants'}
            >
              <GlassTextReveal tint={frostTint} active={ghosting && isFront} ghost={ghostOp} real={isFront ? realOp : undefined} blur={ghostBlur}>
                {front}
              </GlassTextReveal>
            </View>
          </Animated.View>
          {isFront ? null : (
            <Animated.View style={[StyleSheet.absoluteFill, content]} testID={testID && `${testID}-back`}>
              <GlassTextReveal tint={frostTint} style={styles.fill} active={ghosting} ghost={ghostOp} real={realOp} blur={ghostBlur}>
                {back}
              </GlassTextReveal>
            </Animated.View>
          )}
        </Surface>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({ hidden: { opacity: 0 }, fill: { flex: 1 } });
