import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassSurface } from '../../components/glass/GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Back side of the balance card (ADR-027): the card's own glass frames it; a 2x2 grid of glass tiles fills it edge to edge. Transfer is live; the rest are greyed placeholders.
// `transferReason` is the short text shown when transfer isn't possible.
// Gutters live on wrapper Views OUTSIDE each tile's Pressable, so a tap on a gutter (or the face) falls through
// to the card and swaps it back; a tap on a tile never does (noop when inert).
const noop = () => {};
const PLACEHOLDERS = ['pricetag-outline', 'calendar-outline', 'stats-chart-outline'];

export const BalanceOptions = ({ canTransfer, transferReason, onTransfer, radius }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors, radius);

  const tile = (key, { icon, label, reason, off, onPress, testID, disabled }) => (
    <View key={key} style={styles.cell}>
      <Pressable
        testID={testID}
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onPress={onPress ?? noop}
      >
        <GlassSurface flat style={[styles.tile, off && styles.off]}>
          <Ionicons name={icon} size={22} color={colors.text} />
          <View style={styles.texts}>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
            {reason ? <Text style={styles.reason} numberOfLines={2}>{reason}</Text> : null}
          </View>
        </GlassSurface>
      </Pressable>
    </View>
  );
  const soon = (icon) =>
    tile(icon, { icon, label: t('dashboard.comingSoon'), off: true, disabled: true, testID: 'placeholder-tile' });

  return (
    <View style={styles.face} testID="balance-options">
      <View style={styles.grid}>
        <View style={styles.row}>
          {tile('transfer', {
            icon: 'swap-horizontal',
            label: t('dashboard.transfer'),
            reason: !canTransfer ? transferReason : null,
            off: !canTransfer,
            disabled: !canTransfer,
            onPress: canTransfer ? onTransfer : undefined,
            testID: 'transfer-tile',
          })}
          {soon(PLACEHOLDERS[0])}
        </View>
        <View style={styles.row}>
          {soon(PLACEHOLDERS[1])}
          {soon(PLACEHOLDERS[2])}
        </View>
      </View>
    </View>
  );
};

const makeStyles = (colors, radius = 16) =>
  StyleSheet.create({
    // explicit edges: StyleSheet.absoluteFillObject was removed in RN 0.85 (spreading it silently gives nothing, so the
    // face collapsed to ~0 height and every row overlapped at the top)
    face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: spacing(0.5) },
    grid: { flex: 1 },
    row: { flex: 1, flexDirection: 'row' },
    cell: { flex: 1, padding: spacing(0.5), minHeight: 44 },
    press: { flex: 1 },
    // icon + text side by side: a tile stays legible however short the card is (no vertical stacking to overflow)
    tile: { flex: 1, borderRadius: radius - 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(1), gap: spacing(1) },
    texts: { flex: 1, justifyContent: 'center' },
    off: { opacity: 0.55 },
    label: { color: colors.text, fontSize: font.sm, fontWeight: '700' },
    reason: { color: colors.muted, fontSize: 10 },
  });
