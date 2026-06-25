import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export const AppButton = ({ title, onPress, variant = 'primary', disabled, loading, style }) => {
  const tint =
    variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.primary;
  const txt = variant === 'ghost' ? colors.primary : colors.primaryText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tint, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.primary },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={txt} /> : <Text style={[styles.text, { color: txt }]}>{title}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { borderRadius: radius.md, paddingVertical: spacing(1.75), alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700', fontSize: font.md },
});
