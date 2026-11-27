import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassSurface } from '../../components/glass/GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Back face of the balance card (ADR-027): a transparent frosted face (the blur is the card's static underlay)
// whose 2x2 grid of glass tiles fills it edge to edge. Transfer is live; the rest are greyed placeholders.
// `transferReason` is the short text shown when transfer isn't possible.
// Gutters live on wrapper Views OUTSIDE each tile's Pressable, so a tap on a gutter (or the face) falls through
// to the card and flips it back; a tap on a tile never does (noop when inert).
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
          <Text style={styles.label}>{label}</Text>
          {reason ? <Text style={styles.reason} numberOfLines={2}>{reason}</Text> : null}
        </GlassSurface>
      </Pressable>
    </View>
  );
  const soon = (icon) =>
    tile(icon, { icon, label: t('dashboard.comingSoon'), off: true, disabled: true, testID: 'placeholder-tile' });

  return (
    <GlassSurface flat style={styles.face} testID="balance-options">
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
    </GlassSurface>
  );
};

const makeStyles = (colors, radius = 16) =>
  StyleSheet.create({
    face: { ...StyleSheet.absoluteFillObject, borderRadius: radius, padding: spacing(0.5) },
    grid: { flex: 1 },
    row: { flex: 1, flexDirection: 'row' },
    cell: { flex: 1, padding: spacing(0.5), minHeight: 44 },
    press: { flex: 1 },
    tile: { flex: 1, borderRadius: radius - 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(1) },
    off: { opacity: 0.55 },
    label: { color: colors.text, fontSize: font.sm, fontWeight: '700', marginTop: 2 },
    reason: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  });
