import { StyleSheet, Text, TextInput, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// `right` is an optional adornment pinned to the input's right edge (e.g. the password eye toggle).
export const Field = ({ label, right, ...props }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={{ marginBottom: spacing(2) }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, !!right && styles.inputWithRight]}
          {...props}
        />
        {!!right && <View style={styles.right}>{right}</View>}
      </View>
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
    inputWithRight: { paddingRight: 44 },
    right: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  });
