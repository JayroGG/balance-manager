import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton, Chip, Field } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatMonthYear, formatRange, isISODate, monthPickerYears, monthShortNames, normalizeRange, todayISODate } from '../../utils/dates';

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
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [invalid, setInvalid] = useState(false);

  const locale = i18n.language;
  const close = () => setOpen(null);

  const monthLabel =
    value.kind === 'month' ? formatMonthYear(value.year, value.month, locale) : t('transactions.months');
  const customLabel =
    value.kind === 'custom'
      ? formatRange(value, locale, { fromLabel: t('transactions.from'), untilLabel: t('transactions.until') })
      : t('transactions.custom');

  const openCustom = () => {
    const today = todayISODate();
    setDraft(value.kind === 'custom' ? { from: value.from ?? '', to: value.to ?? '' } : { from: today, to: today });
    setInvalid(false);
    setOpen('custom');
  };

  const applyCustom = () => {
    const range = normalizeRange(draft.from.trim(), draft.to.trim());
    const bad = (v) => v.trim() !== '' && !isISODate(v.trim());
    if (!range || bad(draft.from) || bad(draft.to)) {
      setInvalid(true);
      return;
    }
    onChange({ kind: 'custom', ...range });
    close();
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} testID="date-filter">
        {QUICK.map((k) => (
          <Chip key={k} label={t(`transactions.${QUICK_LABEL[k]}`)} active={value.kind === k} onPress={() => onChange({ kind: k })} />
        ))}
        <Chip label={`${monthLabel} ▾`} active={value.kind === 'month'} onPress={() => setOpen('months')} />
        <Chip label={`${customLabel} ▾`} active={value.kind === 'custom'} onPress={openCustom} />
      </ScrollView>

      <Modal visible={open === 'months'} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {monthPickerYears().map((year) => (
                <View key={year} style={styles.yearBlock}>
                  <Text style={styles.yearTitle}>{year}</Text>
                  <View style={styles.monthGrid}>
                    {monthShortNames(locale).map((name, i) => (
                      <Chip
                        key={name}
                        label={name}
                        active={value.kind === 'month' && value.year === year && value.month === i + 1}
                        onPress={() => {
                          onChange({ kind: 'month', year, month: i + 1 });
                          close();
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={open === 'custom'} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <Field
              label={t('transactions.from')}
              value={draft.from}
              onChangeText={(from) => setDraft((d) => ({ ...d, from }))}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              testID="custom-from"
            />
            <Field
              label={t('transactions.until')}
              value={draft.to}
              onChangeText={(to) => setDraft((d) => ({ ...d, to }))}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              testID="custom-to"
            />
            {invalid ? <Text style={styles.error}>{t('transactions.invalidRange')}</Text> : null}
            <AppButton title={t('transactions.apply')} onPress={applyCustom} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(2) },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing(3) },
    sheet: {
      maxHeight: '75%',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing(2),
    },
    yearBlock: { marginBottom: spacing(1.5) },
    yearTitle: { fontSize: font.sm, fontWeight: '700', color: colors.muted, marginBottom: spacing(0.75) },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    error: { color: colors.danger, fontSize: font.sm, marginBottom: spacing(1.5) },
  });
