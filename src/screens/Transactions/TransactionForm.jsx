import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Field, AppButton, Chip, Muted } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';
import { todayISODate } from '../../utils/dates';

// Shared create/edit form. Transactions are a pure ledger — no vault here; vault funding is an
// amount-based action on the vault detail screen (ADR-009). Enforces amount > 0. (PRD §4.1)
export default function TransactionForm({ initial, categories = [], onSubmit, submitting, error, readOnly }) {
  const { t } = useTranslation();
  const [type, setType] = useState(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ?? todayISODate());
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const isEdit = !!initial;

  // Any field edit clears the "saved" lock so the button re-arms (skip the initial mount).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaved(false);
  }, [type, amount, categoryId, description, occurredAt]);

  const eligibleCategories = useMemo(
    () => categories.filter((c) => c.kind === type || c.kind === 'both'),
    [categories, type],
  );

  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0;

  // In edit mode, the Save button locks (✓ Saved) until a field differs from the saved record.
  const dirty =
    !isEdit ||
    type !== initial.type ||
    amountNum !== Number(initial.amount) ||
    (categoryId ?? null) !== (initial.category_id ?? null) ||
    description.trim() !== (initial.description ?? '') ||
    occurredAt !== initial.occurred_at;
  const locked = isEdit && (saved || !dirty);

  const setTypeSafe = (next) => {
    setType(next);
    setCategoryId(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!amountValid) return;
    const body = { type, amount: amountNum, occurred_at: occurredAt };
    if (categoryId) body.category_id = categoryId;
    if (description.trim()) body.description = description.trim();
    const ok = await onSubmit(body);
    if (ok && isEdit) setSaved(true);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('transactions.type')}</Text>
      <View style={styles.row}>
        <Chip label={t('transactions.expense')} active={type === 'expense'} onPress={() => setTypeSafe('expense')} />
        <Chip label={t('transactions.income')} active={type === 'income'} onPress={() => setTypeSafe('income')} />
      </View>

      <Field
        label={t('transactions.amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      {touched && !amountValid ? <Muted style={styles.err}>{t('transactions.amountPositive')}</Muted> : null}

      <Text style={styles.label}>{t('transactions.category')}</Text>
      <View style={styles.row}>
        {eligibleCategories.length === 0 ? <Muted>{t('common.none')}</Muted> : null}
        {eligibleCategories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
        ))}
      </View>

      <Field label={t('transactions.description')} value={description} onChangeText={setDescription} placeholder="—" />
      <Field label={t('transactions.date')} value={occurredAt} onChangeText={setOccurredAt} placeholder="YYYY-MM-DD" autoCapitalize="none" />

      {error ? <Muted style={styles.err}>{error.message}</Muted> : null}
      {/* Create: keep the primary CTA (disabled until valid). Edit: show Save only when there are valid
          unsaved changes — it hides again once saved (locked) or when nothing has changed. */}
      {readOnly ? (
        <Muted style={styles.readOnly}>{t('teams.readOnly')}</Muted>
      ) : !isEdit || (amountValid && !locked) ? (
        <AppButton
          title={t('common.save')}
          onPress={submit}
          loading={submitting}
          disabled={!amountValid}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
  err: { color: colors.danger, marginBottom: spacing(1.5) },
  readOnly: { textAlign: 'center', marginTop: spacing(1) },
});
