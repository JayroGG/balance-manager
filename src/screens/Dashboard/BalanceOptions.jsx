import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassSurface } from '../../components/glass/GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Back side of the balance card (ADR-027): the card's own glass frames it. Transfer takes the first slot (top-left, on the card's padding), with two dimmed
// non-interactive 'soon' slots beside it, spread evenly; each is a small glass disc (the icon only) that floats on the card with a soft lift, its label as plain text underneath, no box.
// `transferReason` is the short text shown when transfer isn't possible.
// Only the disc + label take a tap (a no-op when inert); everything else is plain Views, so a tap anywhere else
// falls through to the card and swaps it back.
const DISC = 56;
const SOON_ICONS = ['pricetag-outline', 'stats-chart-outline'];

export const BalanceOptions = ({ canTransfer, transferReason, onTransfer }) => {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors, scheme === 'dark');

  const disc = (icon) => (
    <View style={styles.lift}>
      <GlassSurface flat style={styles.disc}>
        <Ionicons name={icon} size={24} color={colors.text} />
      </GlassSurface>
    </View>
  );
  // Placeholders are plain Views, never Pressables: pointerEvents none, so a tap on them falls through and swaps back.
  const soon = (icon) => (
    <View
      key={icon}
      testID="placeholder-slot"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.slot, styles.dim]}
    >
      {disc(icon)}
      <Text style={styles.label} numberOfLines={1}>{t('dashboard.soon')}</Text>
    </View>
  );

  return (
    <View style={styles.face} testID="balance-options">
      <Pressable
        testID="transfer-tile"
        style={[styles.slot, !canTransfer && styles.off]}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.transfer')}
        accessibilityHint={!canTransfer ? transferReason : undefined}
        accessibilityState={{ disabled: !canTransfer }}
        onPress={canTransfer ? onTransfer : undefined}
      >
        {disc('swap-horizontal')}
        <Text style={styles.label} numberOfLines={1}>{t('dashboard.transfer')}</Text>
      </Pressable>
      {SOON_ICONS.map(soon)}
      {/* full width under the row (a slot is too narrow for it); plain text, so a tap on it swaps back */}
      {!canTransfer && transferReason ? <Text style={styles.reason} numberOfLines={2}>{transferReason}</Text> : null}
    </View>
  );
};

const makeStyles = (colors, dark) =>
  StyleSheet.create({
    // explicit edges: StyleSheet.absoluteFillObject was removed in RN 0.85 (spreading it silently gives nothing, so the
    // face collapsed to ~0 height and every row overlapped at the top)
    face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: spacing(3), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'flex-start' },
    // three slots spread evenly; Transfer is the first. Each label centres under its disc.
    slot: { alignItems: 'center' },
    dim: { opacity: 0.4 },
    // the shadow lives on a wrapper: the glass disc clips its own overflow
    lift: { borderRadius: DISC / 2, boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 18, color: 'rgba(0,0,0,0.28)' }] },
    disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
    off: { opacity: 0.55 },
    label: { color: colors.text, fontSize: font.sm, fontWeight: '600', letterSpacing: 0.4, marginTop: spacing(1),
      // the label lifts with the disc (same drop direction), so they read as one floating object; lighter in dark mode
      textShadowColor: dark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.22)',
      textShadowOffset: { width: 0, height: dark ? 1 : 2 },
      textShadowRadius: dark ? 3 : 5,
    },
    reason: { color: colors.muted, fontSize: font.sm, width: '100%', marginTop: spacing(1.5) },
  });
