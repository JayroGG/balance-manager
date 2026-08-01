import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { font, radius, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

export const AppButton = ({ title, successTitle, onPress, variant = 'primary', disabled, loading, success, style }) => {
  const { colors } = useTheme();
  const baseTint =
    variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.primary;
  const tint = success ? colors.success : baseTint;
  const txt = success ? colors.primaryText : variant === 'ghost' ? colors.primary : colors.primaryText;
  const label = success ? `✓ ${successTitle ?? title}` : title;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      disabled={disabled || loading || success}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tint, borderWidth: variant === 'ghost' && !success ? 1 : 0, borderColor: colors.primary },
        (disabled || loading) && !success && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={txt} /> : <Text style={[styles.text, { color: txt }]}>{label}</Text>}
    </Pressable>
  );
};

// The whole button is the target, not the label: `alignSelf: stretch` keeps it full-width even inside
// a centering parent, and `minHeight` holds the 48dp floor whatever the label's line height.
const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing(1.75),
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '700', fontSize: font.md },
});
