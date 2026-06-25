import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, spacing } from '../theme';

export const Chip = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
  >
    <Text style={[styles.text, active && { color: colors.primaryText }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  text: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
});
