import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { depth, flip, springs, tapHaptic } from '../../theme/motion';

// Generic "flip a 3D object" card (ADR-027): cartoony springy rotateY with overshoot, squash/stretch,
// perspective and a layered boxShadow that shifts with the rotation. Knows nothing about its content.
//   front / back  render props (the front defines the size; the back fills it)
//   flipped       controlled; onFlip(next) is asked for on tap of the visible face
// Reduce Motion: a short crossfade, no rotation/scale.
export const FlipCard3D = ({ flipped, onFlip, front, back, style, testID, radius = 16, backLabel }) => {
  const reduce = useReducedMotion();
  const progress = useSharedValue(flipped ? 1 : 0);

  useEffect(() => {
    progress.value = reduce
      ? withTiming(flipped ? 1 : 0, { duration: flip.reducedMs })
      : withSpring(flipped ? 1 : 0, springs.toony);
  }, [flipped, reduce, progress]);

  const angle = useDerivedValue(() => interpolate(progress.value, [0, 1], [0, 180]));

  // Scale/lift live on the container; perspective must sit in each face's own transform (RN doesn't pass
  // it down to children). The shadow is its own layer behind the faces so it can narrow with the card.
  const container = useAnimatedStyle(() => {
    if (reduce) return { transform: [{ scale: 1 }] };
    const lift = Math.sin(Math.min(Math.max(progress.value, 0), 1) * Math.PI); // 0 at rest, 1 mid-flip
    return { transform: [{ scale: 1 + flip.squash * lift }] };
  });

  const shadow = useAnimatedStyle(() => {
    if (reduce) return { boxShadow: [] };
    const rad = (angle.value * Math.PI) / 180;
    const lift = Math.sin(Math.min(Math.max(progress.value, 0), 1) * Math.PI);
    const y = depth.rest.y + (depth.lifted.y - depth.rest.y) * lift;
    const blur = depth.rest.blur + (depth.lifted.blur - depth.rest.blur) * lift;
    const alpha = depth.rest.alpha + (depth.lifted.alpha - depth.rest.alpha) * lift;
    return {
      transform: [{ scaleX: Math.max(Math.abs(Math.cos(rad)), 0.02) }],
      boxShadow: [
        { offsetX: -Math.sin(rad) * depth.lifted.shift * 0.6, offsetY: y, blurRadius: blur, color: `rgba(0,0,0,${alpha.toFixed(3)})` },
        { offsetX: -Math.sin(rad) * depth.lifted.shift, offsetY: y * 1.8, blurRadius: blur * 1.6, color: `rgba(0,0,0,${(alpha * 0.5).toFixed(3)})` },
      ],
    };
  });

  const frontFace = useAnimatedStyle(() =>
    reduce
      ? { opacity: 1 - progress.value, transform: [{ rotateY: '0deg' }] }
      : { opacity: 1, transform: [{ perspective: flip.perspective }, { rotateY: `${angle.value}deg` }] },
  );
  const backFace = useAnimatedStyle(() =>
    reduce
      ? { opacity: progress.value, transform: [{ rotateY: '0deg' }] }
      : { opacity: 1, transform: [{ perspective: flip.perspective }, { rotateY: `${angle.value - 180}deg` }] },
  );

  const toggle = () => {
    tapHaptic();
    onFlip?.(!flipped);
  };

  return (
    <Animated.View testID={testID} style={[{ borderRadius: radius }, container, style]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, shadow]} />
      <Animated.View style={[styles.face, frontFace]} pointerEvents={flipped ? 'none' : 'auto'}>
        <Pressable
          onPress={toggle}
          testID={testID && `${testID}-front`}
          accessibilityRole="button"
          accessibilityState={{ expanded: flipped }}
        >
          {front}
        </Pressable>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, backFace]} pointerEvents={flipped ? 'auto' : 'none'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={toggle}
          testID={testID && `${testID}-back`}
          accessible={false} // keep the tiles individually reachable by screen readers
          accessibilityLabel={backLabel}
          onAccessibilityEscape={toggle} // VoiceOver two-finger scrub = flip back
        >
          {back}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({ face: { backfaceVisibility: 'hidden' } });
