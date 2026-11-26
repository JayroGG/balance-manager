import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { font, spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';
import { normalizeHex } from '../../utils/colors';
import { formatMonthTitle, isBetween, monthGrid, pickRangeDay, shiftMonth, weekdayLabels } from '../../utils/dates';

// Lightweight month calendar for the Custom range (Monday-first). First tap = start, second = end
// (earlier than the start swaps them; the same day twice = a single day), a third tap starts over.
// Controlled: `value` is { start, end } (ISO or null), `onChange` receives the next one.
export function RangeCalendar({ value, onChange, locale }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const anchor = value.start ? DateTime.fromISO(value.start) : DateTime.now();
  const [shown, setShown] = useState({ year: anchor.year, month: anchor.month });
  const weeks = monthGrid(shown.year, shown.month);

  return (
    <View>
      <View style={styles.header}>
        <Pressable hitSlop={12} testID="cal-prev" accessibilityRole="button" accessibilityLabel={t('transactions.prevMonth')} style={styles.arrow} onPress={() => setShown((m) => shiftMonth(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} testID="cal-title">{formatMonthTitle(shown, locale)}</Text>
        <Pressable hitSlop={12} testID="cal-next" accessibilityRole="button" accessibilityLabel={t('transactions.nextMonth')} style={styles.arrow} onPress={() => setShown((m) => shiftMonth(m, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdayLabels(locale).map((label, i) => (
          <Text key={i} style={styles.weekday} numberOfLines={1}>{label}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((iso, di) => {
            if (!iso) return <View key={di} style={styles.cell} />;
            const edge = iso === value.start || iso === value.end;
            const between = isBetween(value, iso);
            return (
              <Pressable
                key={di}
                testID={`day-${iso}`}
                accessibilityRole="button"
                accessibilityLabel={DateTime.fromISO(iso).setLocale(locale).toLocaleString(DateTime.DATE_FULL)}
                accessibilityState={{ selected: edge }}
                style={[styles.cell, between && styles.between]}
                onPress={() => onChange(pickRangeDay(value, iso))}
              >
                <View style={[styles.day, edge && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.dayText, edge && { color: colors.primaryText, fontWeight: '800' }]}>{DateTime.fromISO(iso).day}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
    arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: font.md, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
    week: { flexDirection: 'row' },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.muted, paddingBottom: spacing(0.5), textTransform: 'capitalize' },
    cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
    between: { backgroundColor: `${normalizeHex(colors.primary) ?? colors.primary}26` },
    day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: font.sm, color: colors.text },
  });
