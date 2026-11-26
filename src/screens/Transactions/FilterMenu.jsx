import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';

// Small option menu for the Transactions filters: a centered sheet over a dimmed backdrop (same
// presentation as the Months/Custom pickers). `options` = [{ key, label, selected }]; every row is a
// full-width 48dp target. Selecting calls onSelect(key) — the caller decides whether to close. `children`
// replace the option list inside the SAME modal (month / range pickers): iOS can't reliably present a second
// Modal while the first is still dismissing, so a menu → picker hop must not be two modals.
export function FilterMenu({ visible, onClose, options, onSelect, testID, children }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} testID={testID}>
          {children ? <View style={styles.custom}>{children}</View> : options.map((o) => (
            <Pressable
              key={o.key}
              style={styles.row}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: !!o.selected }}
              testID={`${testID}-${o.key}`}
              onPress={() => onSelect(o.key)}
            >
              <Text numberOfLines={1} style={[styles.label, o.selected && { color: colors.primary, fontWeight: '700' }]}>{o.label}</Text>
              {o.selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing(3) },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: spacing(0.5),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: spacing(2),
    },
    custom: { padding: spacing(2) },
    label: { fontSize: font.md, color: colors.text, flexShrink: 1 },
  });
