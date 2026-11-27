import { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { pastelPalette } from '../../utils/colors';
import { BlurTargetContext, nativeBlurAvailable } from './glassSupport';

// The scene BEHIND a glass card (ADR-027): soft pastel blobs derived from the context accent, plus a few crisp
// shapes so the blur is obviously visible (crisp outside the card, frosted inside). The accent lives here, not in
// the card. Android needs the blurred content wrapped in a BlurTargetView; GlassFill reads its ref from context.
const blob = (color, size, pos) => ({
  position: 'absolute',
  width: size,
  height: size,
  borderRadius: size / 2,
  experimental_backgroundImage: `radial-gradient(circle at center, ${color} 0%, ${color} 35%, transparent 72%)`,
  ...pos,
});
const shape = (color, w, h, r, pos) => ({ position: 'absolute', width: w, height: h, borderRadius: r, backgroundColor: color, ...pos });

export const GlassBackdrop = ({ accent, children, style, testID }) => {
  const { colors, scheme } = useTheme();
  const target = useRef(null);
  const [a, b, c] = pastelPalette(accent, scheme);
  const Target = Platform.OS === 'android' && nativeBlurAvailable() ? BlurTargetView : View;
  return (
    <View testID={testID} style={[styles.scene, { backgroundColor: scheme === 'dark' ? colors.bg : '#FFFFFF' }, style]}>
      <Target ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={blob(a, 260, { top: -80, left: -70 })} />
        <View style={blob(b, 240, { bottom: -90, right: -60 })} />
        <View style={blob(c, 170, { top: 30, right: 40 })} />
        <View style={shape(b, 54, 54, 27, { top: 14, right: 26, opacity: 0.9 })} />
        <View style={shape(c, 96, 30, 15, { bottom: 18, left: 22, opacity: 0.9 })} />
        <View style={shape(a, 38, 38, 12, { bottom: 54, right: 90, opacity: 0.85 })} />
      </Target>
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({ scene: { overflow: 'hidden', borderRadius: 20 } });
