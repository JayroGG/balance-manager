import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export const Card = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
