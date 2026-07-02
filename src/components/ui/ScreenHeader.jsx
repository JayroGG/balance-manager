import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { font, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// The one in-screen header (native stack headers are hidden — the whole app uses the Dashboard's
// large-title look). `back` shows an accent chevron on pushed/modal screens (swipe-back still works);
// `right` is a slot for screen actions (add, rename, …).
export const ScreenHeader = ({ title, back = false, right = null, style }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.row, style]}>
      {back ? (
        <Pressable hitSlop={10} testID="header-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing(1.5) },
    back: { marginLeft: -spacing(0.75), marginRight: spacing(0.5) },
    title: { flex: 1, fontSize: font.xl, fontWeight: '800', color: colors.text },
  });
