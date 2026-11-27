import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { depth, flip, springs, tapHaptic } from '../../theme/motion';

// Generic "flip a 3D object" card (ADR-027). Floats like it's suspended in air: a pan rotates it live
// around Y (with a little X tilt) following the finger, and on release it snaps to the nearest face with an
// underdamped spring (natural wobble). A plain tap flips too. Knows nothing about its content.
//   front / back  render props; both faces share ONE layout box (the front sizes it, the back fills it)
//   underlay      optional static layer under both faces (e.g. the native blur): it never rotates — it only
//                 narrows with |cos| like the shadow — because a native blur under a 3D transform glitches/darkens
//   flipped       controlled; onFlip(next) is asked for after a tap or a snap to the other face
// Reduce Motion: no gesture, no rotation — a short crossfade.
// `progress` is the signed turn in [-1, 1] (±1 = back face, from either direction), `angle` = progress*180.
export const FlipCard3D = ({ flipped, onFlip, front, back, underlay, style, testID, radius = 16 }) => {
  const reduce = useReducedMotion();
  const progress = useSharedValue(flipped ? 1 : 0);
  const tilt = useSharedValue(0);
  const held = useSharedValue(0);
  const settled = useRef(flipped ? 1 : 0); // where the last snap/animation is heading (-1 | 0 | 1)
  const width = useRef(320);
  const base = useRef(0);

  // Prop-driven flips (tap, auto flip-back). Skipped when a gesture already animated to this state.
  useEffect(() => {
    if ((settled.current !== 0) === !!flipped) return;
    const to = flipped ? 1 : 0;
    settled.current = to;
    progress.value = reduce
      ? withTiming(to, { duration: flip.reducedMs })
      : withSpring(to, springs.toony);
  }, [flipped, reduce, progress]);

  const angle = useDerivedValue(() => progress.value * 180);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!reduce)
    .activeOffsetX([-10, 10])
    .failOffsetY([-24, 24]) // a vertical drag is the page scroll, not the card
    .onStart(() => {
      base.current = progress.value; // assigning cancels a running spring: the finger takes over
      progress.value = base.current;
      held.value = withSpring(1, springs.settle);
    })
    .onUpdate((e) => {
      const next = base.current + e.translationX / (width.current * flip.dragSpan);
      progress.value = Math.max(-1, Math.min(1, next));
      tilt.value = Math.max(-flip.tiltMax, Math.min(flip.tiltMax, -e.translationY * 0.25));
    })
    .onEnd((e) => {
      const projected = progress.value + (e.velocityX / width.current) * flip.throw;
      const to = Math.abs(projected) >= 0.5 ? (projected < 0 ? -1 : 1) : 0;
      settled.current = to;
      const v = e.velocityX / (width.current * flip.dragSpan);
      progress.value = withSpring(to, { ...springs.magnetic, velocity: Math.max(-flip.maxVelocity, Math.min(flip.maxVelocity, v)) });
      if ((to !== 0) !== !!flipped) {
        tapHaptic();
        onFlip?.(to !== 0);
      }
    })
    .onFinalize(() => {
      held.value = withSpring(0, springs.settle);
      tilt.value = withSpring(0, springs.magnetic);
    });

  // Scale/lift on the container; perspective must sit in each face's own transform (RN doesn't pass it
  // down). The shadow is its own layer behind the faces so it can narrow with the card.
  const container = useAnimatedStyle(() => {
    if (reduce) return { transform: [{ scale: 1 }] };
    const lift = Math.sin(Math.min(Math.abs(progress.value), 1) * Math.PI); // 0 at rest, 1 mid-flip
    return { transform: [{ scale: 1 + flip.squash * lift + flip.grabScale * held.value }] };
  });

  // Narrows with the card as it turns edge-on (shared by the shadow and the underlay).
  const narrow = useAnimatedStyle(() => {
    if (reduce) return { transform: [{ scaleX: 1 }] };
    const rad = (angle.value * Math.PI) / 180;
    return { transform: [{ scaleX: Math.max(Math.abs(Math.cos(rad)), 0.02) }] };
  });

  const shadow = useAnimatedStyle(() => {
    if (reduce) return { boxShadow: [] };
    const rad = (angle.value * Math.PI) / 180;
    const lift = Math.min(1, Math.sin(Math.min(Math.abs(progress.value), 1) * Math.PI) + held.value * 0.6);
    const y = depth.rest.y + (depth.lifted.y - depth.rest.y) * lift;
    const blur = depth.rest.blur + (depth.lifted.blur - depth.rest.blur) * lift;
    const alpha = depth.rest.alpha + (depth.lifted.alpha - depth.rest.alpha) * lift;
    return {
      boxShadow: [
        { offsetX: -Math.sin(rad) * depth.lifted.shift * 0.6, offsetY: y, blurRadius: blur, color: `rgba(0,0,0,${alpha.toFixed(3)})` },
        { offsetX: -Math.sin(rad) * depth.lifted.shift, offsetY: y * 1.8, blurRadius: blur * 1.6, color: `rgba(0,0,0,${(alpha * 0.5).toFixed(3)})` },
      ],
    };
  });

  const frontFace = useAnimatedStyle(() =>
    reduce
      ? { opacity: 1 - Math.abs(progress.value), transform: [{ rotateY: '0deg' }] }
      : {
          opacity: 1,
          transform: [{ perspective: flip.perspective }, { rotateX: `${tilt.value}deg` }, { rotateY: `${angle.value}deg` }],
        },
  );
  const backFace = useAnimatedStyle(() =>
    reduce
      ? { opacity: Math.abs(progress.value), transform: [{ rotateY: '0deg' }] }
      : {
          opacity: 1,
          transform: [
            { perspective: flip.perspective },
            { rotateX: `${tilt.value}deg` },
            { rotateY: `${angle.value - (progress.value < 0 ? -180 : 180)}deg` },
          ],
        },
  );

  const toggle = () => {
    tapHaptic();
    onFlip?.(!flipped);
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={testID}
        style={[{ borderRadius: radius }, container, style]}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width || width.current;
        }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, narrow, shadow]} />
        {underlay ? (
          <Animated.View
            testID={testID && `${testID}-underlay`}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, narrow]}
          >
            {underlay}
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.face, frontFace]} pointerEvents={flipped ? 'none' : 'auto'}>
          {/* The Pressable is the single, whole-face touch target: the content never takes the touch. */}
          <Pressable
            onPress={toggle}
            testID={testID && `${testID}-front`}
            accessibilityRole="button"
            accessibilityState={{ expanded: flipped }}
          >
            <View pointerEvents="none">{front}</View>
          </Pressable>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.face, backFace]} pointerEvents={flipped ? 'auto' : 'none'}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={toggle}
            testID={testID && `${testID}-back`}
            accessible={false} // keep the tiles individually reachable by screen readers
            onAccessibilityEscape={toggle} // VoiceOver two-finger scrub = flip back
          >
            {back}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({ face: { backfaceVisibility: 'hidden' } });
