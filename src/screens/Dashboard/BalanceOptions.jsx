import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassSurface, useReduceTransparency } from '../../components/glass/GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { font, radius, spacing } from '../../components/theme';

// Back face of the balance card (ADR-027): glass option tiles. Transfer is live; the rest are
// greyed placeholders so the layout is ready for future options. `transferReason` is the short text shown
// when transfer isn't possible (tile disabled).
const noop = () => {};
const PLACEHOLDERS = ['pricetag-outline', 'calendar-outline', 'stats-chart-outline'];

export const BalanceOptions = ({ canTransfer, transferReason, onTransfer }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Reduce Transparency swaps the glass for an opaque card-colored tile: ink must follow it.
  const ink = useReduceTransparency() ? colors.text : colors.primaryText;
  const styles = makeStyles(colors, ink);
  return (
    <View style={styles.face} testID="balance-options">
      <View style={styles.grid}>
        <Pressable
          testID="transfer-tile"
          style={styles.cell}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canTransfer }}
          onPress={canTransfer ? onTransfer : noop} // always takes the touch: a tap on a disabled tile must not flip the card back
        >
          <GlassSurface style={[styles.tile, !canTransfer && styles.off]}>
            <Ionicons name="swap-horizontal" size={22} color={ink} />
            <Text style={styles.label}>{t('dashboard.transfer')}</Text>
            {!canTransfer && transferReason ? <Text style={styles.reason} numberOfLines={2}>{transferReason}</Text> : null}
          </GlassSurface>
        </Pressable>
        {PLACEHOLDERS.map((icon) => (
          <Pressable key={icon} style={styles.cell} testID="placeholder-tile" accessibilityRole="button" accessibilityLabel={t('dashboard.comingSoon')} accessibilityState={{ disabled: true }} onPress={noop}>
            <GlassSurface style={[styles.tile, styles.off]}>
              <Ionicons name={icon} size={22} color={ink} />
              <Text style={styles.label}>{t('dashboard.comingSoon')}</Text>
            </GlassSurface>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const makeStyles = (colors, ink) =>
  StyleSheet.create({
    face: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing(1) },
    grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: '50%', height: '50%', padding: spacing(0.5), minHeight: 44 },
    tile: { flex: 1, borderRadius: radius.md - 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(1) },
    off: { opacity: 0.5 },
    label: { color: ink, fontSize: font.sm, fontWeight: '700', marginTop: 2 },
    reason: { color: ink, fontSize: 10, textAlign: 'center' },
  });
