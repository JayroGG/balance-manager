import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// `dot` (a hex color) renders a small color swatch before the label — used to preview a team's
// color on the context switch and team lists (ADR-013).
export const Chip = ({ label, active, onPress, dot }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.text, active && { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: spacing(1),
      marginBottom: spacing(1),
    },
    dot: { width: 10, height: 10, borderRadius: 999, marginRight: spacing(0.75) },
    text: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  });
