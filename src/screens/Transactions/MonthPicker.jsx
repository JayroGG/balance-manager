import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { font, spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';
import { monthShortNames } from '../../utils/dates';

const YEARS_BACK = 20;

// Compact month picker: a year header with ‹ › arrows over a 4×3 grid of short month names.
// The year can't go past the current one, and future months of the current year are disabled.
// `value` is the active { year, month } (or null); `onPick(year, month)` fires on a tap.
export function MonthPicker({ value, onPick, locale, now = DateTime.now() }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [year, setYear] = useState(value?.year ?? now.year);
  const names = monthShortNames(locale);
  const canPrev = year > now.year - YEARS_BACK;
  const canNext = year < now.year;

  return (
    <View>
      <View style={styles.header}>
        <Pressable hitSlop={12} disabled={!canPrev} accessibilityState={{ disabled: !canPrev }} testID="year-prev" accessibilityRole="button" accessibilityLabel={t('transactions.prevYear')} style={styles.arrow} onPress={() => setYear((y) => y - 1)}>
          <Ionicons name="chevron-back" size={22} color={canPrev ? colors.text : colors.border} />
        </Pressable>
        <Text style={styles.year} testID="year-label">{year}</Text>
        <Pressable hitSlop={12} disabled={!canNext} accessibilityState={{ disabled: !canNext }} testID="year-next" accessibilityRole="button" accessibilityLabel={t('transactions.nextYear')} style={styles.arrow} onPress={() => setYear((y) => y + 1)}>
          <Ionicons name="chevron-forward" size={22} color={canNext ? colors.text : colors.border} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {names.map((name, i) => {
          const month = i + 1;
          const future = year === now.year && month > now.month;
          const active = value?.year === year && value?.month === month;
          return (
            <Pressable
              key={name}
              disabled={future}
              testID={`month-${month}`}
              accessibilityRole="button"
              accessibilityLabel={`${name} ${year}`}
              accessibilityState={{ disabled: future, selected: active }}
              style={styles.cell}
              onPress={() => onPick(year, month)}
            >
              <View style={[styles.pill, active && { backgroundColor: colors.primary, borderColor: colors.primary }, future && styles.pillDisabled]}>
                <Text style={[styles.cellText, active && { color: colors.primaryText }]} numberOfLines={1}>{name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
    arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    year: { fontSize: font.lg, fontWeight: '800', color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: '25%', padding: spacing(0.5) },
    pill: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    pillDisabled: { opacity: 0.35 },
    cellText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  });
