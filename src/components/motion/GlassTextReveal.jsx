import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

// "Text formed by the glass" (ADR-027). Wraps any content and, while `active`, renders it THREE times over the same
// box: a blurred, low-contrast GHOST of the exact same tree (the template, hidden from a11y/queries), a frosted
// layer over it (iOS: a BlurView; Android: a real `filter: blur` on the ghost), and the REAL content on top. PressSwap
// drives the shared values: the ghost appears, the real text fades/sharpens in superimposed on it (the overlap reads
// brighter), then the ghost dissolves while the real text settles crisp.
//   ghost / blur  shared values: ghost opacity, and ghost blur px (Android)
//   tint          BlurView tint for the frost on iOS ('light' | 'dark' | 'default')
//   real          shared value: real content opacity (omit = always 1)
// iOS has no style-level blur, hence the BlurView over the ghost; keep that BlurView opaque (alpha < 1 breaks
// UIVisualEffectView) and just unmount it with the ghost.
export const GlassTextReveal = ({ active, ghost, real, blur, tint = 'default', style, children }) => {
  const realStyle = useAnimatedStyle(() => ({ opacity: real ? real.value : 1 }));
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghost ? ghost.value : 0,
    ...(Platform.OS === 'android' && blur ? { filter: [{ blur: blur.value }] } : null),
  }));
  return (
    <View style={style}>
      {active ? (
        <>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[StyleSheet.absoluteFill, ghostStyle]}
          >
            {children}
          </Animated.View>
          {Platform.OS === 'ios' ? (
            <BlurView
              testID="reveal-frost"
              pointerEvents="none"
              intensity={45}
              tint={tint}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </>
      ) : null}
      <Animated.View style={[style, realStyle]}>{children}</Animated.View>
    </View>
  );
};
