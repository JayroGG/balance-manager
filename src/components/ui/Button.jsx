import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export const AppButton = ({ title, successTitle, onPress, variant = 'primary', disabled, loading, success, style }) => {
  const baseTint =
    variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.primary;
  const tint = success ? colors.success : baseTint;
  const txt = success ? colors.primaryText : variant === 'ghost' ? colors.primary : colors.primaryText;
  const label = success ? `✓ ${successTitle ?? title}` : title;
  return (
    <Pressable
      onPress={onPress}
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

const styles = StyleSheet.create({
  button: { borderRadius: radius.md, paddingVertical: spacing(1.75), alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700', fontSize: font.md },
});
