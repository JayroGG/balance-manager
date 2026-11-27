import { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { pastel } from '../../utils/colors';
import { BlurTargetContext, nativeBlurAvailable } from './glassSupport';

// The scene BEHIND a glass card (ADR-027): ONE soft, low-saturation, low-contrast glow of the context accent on a
// neutral base. The accent lives here, not in the card. Android needs the blurred content wrapped in a
// BlurTargetView; GlassFill reads its ref from context.
export const GlassBackdrop = ({ accent, children, style, testID }) => {
  const { colors, scheme } = useTheme();
  const target = useRef(null);
  const glow = pastel(accent, scheme);
  const Target = Platform.OS === 'android' && nativeBlurAvailable() ? BlurTargetView : View;
  return (
    <View testID={testID} style={[styles.scene, { backgroundColor: scheme === 'dark' ? colors.bg : '#FFFFFF' }, style]}>
      <Target ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            top: -120,
            left: -80,
            width: 420,
            height: 420,
            borderRadius: 210,
            opacity: scheme === 'dark' ? 0.35 : 0.55,
            experimental_backgroundImage: `radial-gradient(circle at center, ${glow} 0%, transparent 70%)`,
          }}
        />
      </Target>
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({ scene: { overflow: 'hidden', borderRadius: 20 } });
