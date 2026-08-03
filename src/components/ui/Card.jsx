import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

export const Card = ({ children, style, onPress, testID }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]} testID={testID}>{children}</View>;
};

const makeStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing(2),
      marginBottom: spacing(1.5),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
