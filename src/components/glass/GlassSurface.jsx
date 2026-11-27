import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../hooks/useTheme';

// The one glass component (ADR-027). Picks the best surface available:
//   'solid'  — Reduce Transparency is on: opaque tile, no blur
//   'liquid' — iOS 26+ liquid glass (expo-glass-effect)
//   'blur'   — Android + older iOS (expo-blur)
export const pickGlassKind = ({ reduceTransparency, liquid }) =>
  reduceTransparency ? 'solid' : liquid ? 'liquid' : 'blur';

const liquidAvailable = () => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
};

export const useReduceTransparency = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => live && setOn(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setOn);
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return on;
};

export const GlassSurface = ({ children, style, intensity = 40, testID }) => {
  const { colors, scheme } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const kind = pickGlassKind({ reduceTransparency, liquid: liquidAvailable() });
  const base = [styles.surface, { borderColor: colors.border }, style];

  if (kind === 'solid') {
    return (
      <View testID={testID} accessibilityLabel="glass-solid" style={[base, { backgroundColor: colors.card }]}>
        {children}
      </View>
    );
  }
  if (kind === 'liquid') {
    return (
      <GlassView testID={testID} accessibilityLabel="glass-liquid" glassEffectStyle="regular" style={base}>
        {children}
      </GlassView>
    );
  }
  return (
    <View testID={testID} accessibilityLabel="glass-blur" style={base}>
      <BlurView
        intensity={intensity}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
