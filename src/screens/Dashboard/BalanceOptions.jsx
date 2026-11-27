import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassSurface } from '../../components/glass/GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Back side of the balance card (ADR-027): the card's own glass frames it. Transfer takes the first slot (top-left, on the card's padding) as a small
// glass disc (the icon only) that floats on the card with a soft lift, its label as plain text underneath, no box.
// `transferReason` is the short text shown when transfer isn't possible.
// Only the disc + label take a tap (a no-op when inert); everything else is plain Views, so a tap anywhere else
// falls through to the card and swaps it back.
const DISC = 56;

export const BalanceOptions = ({ canTransfer, transferReason, onTransfer }) => {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors, scheme === 'dark');

  return (
    <View style={styles.face} testID="balance-options">
      <Pressable
        testID="transfer-tile"
        style={[styles.press, !canTransfer && styles.off]}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.transfer')}
        accessibilityHint={!canTransfer ? transferReason : undefined}
        accessibilityState={{ disabled: !canTransfer }}
        onPress={canTransfer ? onTransfer : undefined}
      >
        <View style={styles.lift}>
          <GlassSurface flat style={styles.disc}>
            <Ionicons name="swap-horizontal" size={24} color={colors.text} />
          </GlassSurface>
        </View>
        <Text style={styles.label} numberOfLines={1}>{t('dashboard.transfer')}</Text>
        {!canTransfer && transferReason ? <Text style={styles.reason} numberOfLines={2}>{transferReason}</Text> : null}
      </Pressable>
    </View>
  );
};

const makeStyles = (colors, dark) =>
  StyleSheet.create({
    // explicit edges: StyleSheet.absoluteFillObject was removed in RN 0.85 (spreading it silently gives nothing, so the
    // face collapsed to ~0 height and every row overlapped at the top)
    face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: spacing(3) },
    // first slot: the label centres under the disc, so the group's left edge is the card padding
    press: { alignSelf: 'flex-start', alignItems: 'center', maxWidth: '60%' },
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
    reason: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(0.25) },
  });
