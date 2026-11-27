import { StyleSheet, View } from 'react-native';
import { withAlpha } from '../../utils/colors';

// Android's "crystal" card (ADR-028): only the EDGE is glass. The body is calm and clean (near-white / smoked, no
// gradient); the rim is a thin diagonal sheen that catches light (accent at the top-left, a white glint in the middle,
// fading out toward the bottom-right) with a faint accent glow around it. No native dependency: it is plain RN 0.85
// (new arch) styling — `experimental_backgroundImage` gradient (BackgroundImageDrawable) behind an inset body, an outer
// `boxShadow` glow and an inset 1px top highlight. Overdrawn (`danger`): the sheen and glow turn danger.
const RIM = 1.5;

export const crystalRim = ({ accent, danger, dangerColor, dark }) => {
  if (danger) {
    return {
      gradient: `linear-gradient(135deg, ${withAlpha(dangerColor, 0.95)} 0%, ${withAlpha(dangerColor, 0.55)} 55%, ${withAlpha(dangerColor, 0.85)} 100%)`,
      glow: withAlpha(dangerColor, 0.22),
    };
  }
  return {
    gradient: `linear-gradient(135deg, ${withAlpha(accent, dark ? 0.7 : 0.55)} 0%, rgba(255,255,255,${dark ? 0.2 : 0.7}) 45%, ${withAlpha(accent, dark ? 0.12 : 0.1)} 100%)`,
    glow: withAlpha(accent, dark ? 0.2 : 0.16),
  };
};

export const CrystalSurface = ({ children, style, accent, danger, dangerColor, dark, testID }) => {
  const flat = StyleSheet.flatten(style);
  const radius = flat?.borderRadius ?? 16;
  const rim = crystalRim({ accent, danger, dangerColor, dark });
  return (
    <View
      testID={testID}
      nativeID="glass-crystal"
      style={[
        style,
        {
          borderRadius: radius,
          padding: RIM,
          overflow: 'hidden',
          experimental_backgroundImage: rim.gradient,
          boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 16, color: rim.glow }],
        },
      ]}
    >
      <View
        testID={testID && `${testID}-body`}
        style={{
          flex: 1,
          // an outer `alignItems` (e.g. a centred disc) would otherwise shrink the body to its content's width: a slab
          alignSelf: 'stretch',
          // the caller's content alignment (e.g. a centred icon in a disc) applies to the body, which holds the children
          alignItems: flat?.alignItems,
          justifyContent: flat?.justifyContent,
          borderRadius: Math.max(0, radius - RIM),
          overflow: 'hidden',
          backgroundColor: dark ? 'rgba(20,22,28,0.94)' : 'rgba(255,255,255,0.96)',
          boxShadow: [
            { offsetX: 0, offsetY: 1, blurRadius: 0, color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)', inset: true },
          ],
        }}
      >
        {children}
      </View>
    </View>
  );
};
