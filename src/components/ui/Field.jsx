import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: spacing(2) }}>
    {!!label && <Text style={styles.label}>{label}</Text>}
    <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
  </View>
);

const styles = StyleSheet.create({
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.5),
    fontSize: font.md,
    color: colors.text,
  },
});
