import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { spacing, font } from '../theme';
import { timeAgoMillis } from '../../utils/dates';

// The ADR-019 "stale-but-labelled, not blank" marker: `offline · updated <relative time>`. Renders null
// when there is nothing to say (not offline and never fetched). `color` is REQUIRED to be passed
// explicitly by callers on a non-default background — the Dashboard hero sits on the accent color, so a
// hardcoded muted grey could vanish against a dark accent (ADR-013); pass `colors.primaryText` there.
export const StaleBadge = ({ lastUpdated, offline, color }) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tint = color ?? colors.muted;

  if (!offline && !lastUpdated) return null;

  const when = timeAgoMillis(lastUpdated, i18n.language);
  const label = [offline ? t('common.offline') : null, when ? t('common.updatedAgo', { when }) : null]
    .filter(Boolean)
    .join(' · ');

  if (!label) return null;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.text, { color: tint }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: font.sm },
});
