import { StyleSheet, Text } from 'react-native';
import { colors, font, spacing } from '../theme';

export const SectionTitle = ({ children }) => <Text style={styles.section}>{children}</Text>;

export const Muted = ({ children, style }) => <Text style={[styles.muted, style]}>{children}</Text>;

const styles = StyleSheet.create({
  section: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    marginVertical: spacing(1.5),
  },
  muted: { color: colors.muted, fontSize: font.md },
});
