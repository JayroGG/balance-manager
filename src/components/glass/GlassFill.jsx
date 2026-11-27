import { useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { BlurTargetContext, nativeBlurAvailable, useReduceTransparency } from './glassSupport';

// The real blur of a glass card (ADR-027): ONE static layer under the faces (the faces rotate; a native blur
// under a 3D transform goes dark/glitchy). Paths:
//   Reduce Transparency        -> opaque card color
//   ExpoBlur native present    -> BlurView (iOS UIVisualEffect; Android dimezis via the backdrop's blur target)
//   native missing (a dev client built before expo-blur) -> translucent wash, with a dev warning
// Expo Go bundles expo-blur, so it takes the BlurView path.
let warned = false;
const warnMissing = () => {
  if (__DEV__ && !warned) {
    warned = true;
    console.warn('[glass] ExpoBlur native module not found: this build predates expo-blur, so the card uses a plain translucent wash. Rebuild the dev client.');
  }
};

export const GlassFill = ({ intensity = 80 }) => {
  const { colors, scheme } = useTheme();
  const reduce = useReduceTransparency();
  const target = useContext(BlurTargetContext);
  if (reduce) return <View testID="glass-fill" accessibilityLabel="glass-solid" style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />;
  if (!nativeBlurAvailable()) {
    warnMissing();
    return (
      <View
        testID="glass-fill"
        accessibilityLabel="glass-wash"
        style={[StyleSheet.absoluteFill, { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.55)' }]}
      />
    );
  }
  return (
    <BlurView
      testID="glass-fill"
      accessibilityLabel="glass-blur"
      intensity={intensity}
      tint={scheme === 'dark' ? 'dark' : 'light'}
      blurTarget={Platform.OS === 'android' ? target : undefined}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
};
