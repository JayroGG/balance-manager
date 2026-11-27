import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../components/ui';
import { spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatMonthYear, formatRange } from '../../utils/dates';
import { MonthPicker } from './MonthPicker';
import { RangeCalendar } from './RangeCalendar';
import { FilterMenu } from './FilterMenu';

export const ALL_TIME = { kind: 'all' };
const QUICK = ['all', 'today', 'yesterday', 'week'];
const QUICK_LABEL = { all: 'allTime', today: 'today', yesterday: 'yesterday', week: 'thisWeek' };

// Human label of a filter state ("This week", "Nov 2026", "Nov 1 – Nov 5") for the active-filter line.
export const dateFilterLabel = (value, t, locale) =>
  value.kind === 'month'
    ? formatMonthYear(value.year, value.month, locale)
    : value.kind === 'custom'
      ? formatRange(value, locale)
      : t(`transactions.${QUICK_LABEL[value.kind] ?? 'allTime'}`);

// Calendar icon button for the Transactions list; opens a menu: All time · Today · Yesterday · This week ·
// Months ▸ · Custom ▸. Controlled — `value` is the filter state (see filterRange in utils/dates),
// `onChange` receives the next state. Months and Custom keep their compact pickers (ADR-021).
export function DateFilter({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(null); // 'menu' | 'months' | 'custom' | null
  const [draft, setDraft] = useState({ start: null, end: null });

  const locale = i18n.language;
  const close = () => setOpen(null);
  const active = value.kind !== 'all';

  const openCustom = () => {
    setDraft(value.kind === 'custom' ? { start: value.from, end: value.to } : { start: null, end: null });
    setOpen('custom');
  };

  const onSelect = (key) => {
    if (key === 'months') return setOpen('months');
    if (key === 'custom') return openCustom();
    onChange({ kind: key });
    close();
  };

  // A lone start tap is a one-day range.
  const applyCustom = () => {
    onChange({ kind: 'custom', from: draft.start, to: draft.end ?? draft.start });
    close();
  };

  const options = [
    ...QUICK.map((k) => ({ key: k, label: t(`transactions.${QUICK_LABEL[k]}`), selected: value.kind === k })),
    { key: 'months', label: `${t('transactions.months')} ▸`, selected: value.kind === 'month' },
    { key: 'custom', label: `${t('transactions.custom')} ▸`, selected: value.kind === 'custom' },
  ];

  return (
    <>
      <Pressable
        testID="date-filter-button"
        style={[styles.button, active && styles.buttonActive]}
        accessibilityRole="button"
        accessibilityLabel={t('transactions.filterByDate')}
        accessibilityState={{ selected: active }}
        onPress={() => setOpen('menu')}
      >
        <Ionicons name="calendar-outline" size={22} color={active ? colors.cardAccent : colors.muted} />
      </Pressable>

      <FilterMenu visible={open !== null} onClose={close} options={options} onSelect={onSelect} testID="date-menu">
        {open === 'months' ? (
          <MonthPicker
            value={value.kind === 'month' ? value : null}
            locale={locale}
            onPick={(year, month) => {
              onChange({ kind: 'month', year, month });
              close();
            }}
          />
        ) : open === 'custom' ? (
          <>
            <RangeCalendar value={draft} onChange={setDraft} locale={locale} />
            <View style={styles.actions}>
              <AppButton title={t('common.cancel')} variant="ghost" onPress={close} style={styles.action} />
              <AppButton title={t('transactions.apply')} onPress={applyCustom} disabled={!draft.start} style={styles.action} />
            </View>
          </>
        ) : undefined}
      </FilterMenu>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    // 44pt icon button, same footprint as the search box next to it.
    button: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    buttonActive: { borderWidth: 2, borderColor: colors.cardAccent },
    actions: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.5) },
    action: { flex: 1 },
  });
