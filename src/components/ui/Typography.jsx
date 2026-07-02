import { StyleSheet, Text } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

export const SectionTitle = ({ children }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={styles.section}>{children}</Text>;
};

export const Muted = ({ children, style }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={[styles.muted, style]}>{children}</Text>;
};

const makeStyles = (colors) =>
  StyleSheet.create({
    section: {
      fontSize: font.sm,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      marginVertical: spacing(1.5),
    },
    muted: { color: colors.muted, fontSize: font.md },
  });
