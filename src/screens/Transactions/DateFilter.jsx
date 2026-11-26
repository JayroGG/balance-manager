import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton, Chip } from '../../components/ui';
import { spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatMonthYear, formatRange } from '../../utils/dates';
import { MonthPicker } from './MonthPicker';
import { RangeCalendar } from './RangeCalendar';

export const ALL_TIME = { kind: 'all' };
const QUICK = ['all', 'today', 'yesterday', 'week'];
const QUICK_LABEL = { all: 'allTime', today: 'today', yesterday: 'yesterday', week: 'thisWeek' };

// Date chips for the Transactions list: All · Today · Yesterday · This week · Months ▾ · Custom ▾.
// Controlled — `value` is the filter state (see filterRange in utils/dates), `onChange` receives the
// next state. Months and Custom open compact modals; the active chip carries the chosen label (ADR-021).
export function DateFilter({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(null); // 'months' | 'custom' | null
  const [draft, setDraft] = useState({ start: null, end: null });

  const locale = i18n.language;
  const close = () => setOpen(null);

  const monthLabel =
    value.kind === 'month' ? formatMonthYear(value.year, value.month, locale) : t('transactions.months');
  const customLabel = value.kind === 'custom' ? formatRange(value, locale) : t('transactions.custom');

  const openCustom = () => {
    setDraft(value.kind === 'custom' ? { start: value.from, end: value.to } : { start: null, end: null });
    setOpen('custom');
  };

  // A lone start tap is a one-day range.
  const applyCustom = () => {
    onChange({ kind: 'custom', from: draft.start, to: draft.end ?? draft.start });
    close();
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        testID="date-filter"
      >
        {QUICK.map((k) => (
          <Chip key={k} label={t(`transactions.${QUICK_LABEL[k]}`)} active={value.kind === k} onPress={() => onChange({ kind: k })} />
        ))}
        <Chip label={`${monthLabel} ▾`} active={value.kind === 'month'} onPress={() => setOpen('months')} />
        <Chip label={`${customLabel} ▾`} active={value.kind === 'custom'} onPress={openCustom} />
      </ScrollView>

      <Modal visible={open === 'months'} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <MonthPicker
              value={value.kind === 'month' ? value : null}
              locale={locale}
              onPick={(year, month) => {
                onChange({ kind: 'month', year, month });
                close();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={open === 'custom'} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <RangeCalendar value={draft} onChange={setDraft} locale={locale} />
            <View style={styles.actions}>
              <AppButton title={t('common.cancel')} variant="ghost" onPress={close} style={styles.action} />
              <AppButton title={t('transactions.apply')} onPress={applyCustom} disabled={!draft.start} style={styles.action} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    // A horizontal ScrollView defaults to flexGrow:1 — inside the screen's column that stretches it
    // vertically whenever the list below is short or empty. Pin it to its content height.
    scroll: { flexGrow: 0, flexShrink: 0 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(2) },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing(3) },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing(2),
    },
    actions: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.5) },
    action: { flex: 1 },
  });
