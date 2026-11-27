import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../hooks/useTheme';
import { withAlpha } from '../../utils/colors';
import { nativeBlurAvailable, useReduceTransparency } from './glassSupport';

export { useReduceTransparency };

// The one glass surface (ADR-027). Near-transparent white frosted glass: a light wash, a thin light border and a
// top highlight (no accent tint — the accent lives in the backdrop behind the card). Picks:
//   'solid'  — Reduce Transparency: opaque card color
//   'wash'   — `flat` (the surface rotates/sits over a GlassFill layer) or the native blur is missing: wash only
//   'liquid' — iOS 26+ liquid glass (expo-glass-effect)
//   'blur'   — expo-blur (older iOS)
//   'crystal'— Android (ADR-028): no native blur. Clear tinted fill (white light / smoked dark), accent-lit rim
//              (per-side border colors: strong top-left, faint bottom-right) + inner top highlight
// Never put a native blur/glass under a 3D rotation (it darkens/glitches): rotating faces use `flat`.
export const pickGlassKind = ({ reduceTransparency, liquid, flat = false, blurAvailable = true, android = false }) =>
  reduceTransparency ? 'solid' : android ? 'crystal' : flat ? 'wash' : liquid ? 'liquid' : blurAvailable ? 'blur' : 'wash';

const liquidAvailable = () => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
};

export const GlassSurface = ({ children, style, intensity = 60, flat = false, under, danger = false, testID }) => {
  const { colors, scheme, accent } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const kind = pickGlassKind({ reduceTransparency, liquid: liquidAvailable(), flat, blurAvailable: nativeBlurAvailable(), android: Platform.OS === 'android' });
  const dark = scheme === 'dark';
  const rim = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)';
  const wash = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.32)';
  const base = [styles.surface, { borderColor: rim }, style];
  const highlight = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { experimental_backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,${dark ? 0.14 : 0.4}), rgba(255,255,255,0) 45%)` },
      ]}
    />
  );

  if (kind === 'solid') {
    return (
      <View testID={testID} nativeID="glass-solid" style={[base, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    );
  }
  if (kind === 'crystal') {
    // overdrawn: the whole rim goes danger; otherwise accent, bright at the top-left and fading to the bottom-right
    const lit = danger ? colors.danger : withAlpha(accent, dark ? 0.85 : 0.7);
    const dim = danger ? colors.danger : withAlpha(accent, dark ? 0.22 : 0.18);
    const rimStyle = {
      borderWidth: 1.5,
      borderTopColor: lit,
      borderLeftColor: lit,
      borderRightColor: dim,
      borderBottomColor: dim,
    };
    return (
      <View
        testID={testID}
        nativeID="glass-crystal"
        style={[styles.surface, style, rimStyle, { backgroundColor: dark ? 'rgba(20,22,28,0.64)' : 'rgba(255,255,255,0.8)' }]}
      >
        {highlight}
        {children}
      </View>
    );
  }
  if (kind === 'liquid') {
    return (
      <GlassView testID={testID} nativeID="glass-liquid" glassEffectStyle="clear" style={base}>
        {highlight}
        {children}
      </GlassView>
    );
  }
  return (
    <View testID={testID} nativeID={kind === 'blur' ? 'glass-blur' : 'glass-wash'} style={[base, { backgroundColor: wash }]}>
      {kind === 'blur' ? (
        <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      {under}
      {highlight}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: 1 },
});
