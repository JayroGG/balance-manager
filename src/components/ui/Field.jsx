import { StyleSheet, Text, TextInput, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

export const Field = ({ label, ...props }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={{ marginBottom: spacing(2) }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
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
