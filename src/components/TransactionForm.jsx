import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Field, AppButton, Chip, Muted } from './ui';
import { colors, font, spacing } from './theme';
import { todayISODate } from '../utils/dates';

// Shared create/edit form. Enforces the UI invariants: vault picker is income-only; amount > 0. (PRD §4.1)
export default function TransactionForm({ initial, categories = [], vaults = [], onSubmit, submitting, error }) {
  const { t } = useTranslation();
  const [type, setType] = useState(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? null);
  const [vaultId, setVaultId] = useState(initial?.vault_id ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ?? todayISODate());
  const [touched, setTouched] = useState(false);

  const eligibleCategories = useMemo(
    () => categories.filter((c) => c.kind === type || c.kind === 'both'),
    [categories, type],
  );

  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0;

  const setTypeSafe = (next) => {
    setType(next);
    if (next === 'expense') setVaultId(null); // expense can never carry a vault_id
    setCategoryId(null);
  };

  const submit = () => {
    setTouched(true);
    if (!amountValid) return;
    const body = { type, amount: amountNum, occurred_at: occurredAt };
    if (categoryId) body.category_id = categoryId;
    if (description.trim()) body.description = description.trim();
    if (type === 'income' && vaultId) body.vault_id = vaultId;
    onSubmit(body);
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

      {type === 'income' ? (
        <>
          <Text style={styles.label}>{t('transactions.vault')}</Text>
          <View style={styles.row}>
            {vaults.length === 0 ? <Muted>{t('common.none')}</Muted> : null}
            {vaults.map((v) => (
              <Chip key={v.id} label={v.name} active={vaultId === v.id} onPress={() => setVaultId(vaultId === v.id ? null : v.id)} />
            ))}
          </View>
        </>
      ) : (
        <Muted style={{ marginBottom: spacing(2) }}>{t('transactions.vaultIncomeOnly')}</Muted>
      )}

      <Field label={t('transactions.description')} value={description} onChangeText={setDescription} placeholder="—" />
      <Field label={t('transactions.date')} value={occurredAt} onChangeText={setOccurredAt} placeholder="YYYY-MM-DD" autoCapitalize="none" />

      {error ? <Muted style={styles.err}>{error.message}</Muted> : null}
      <AppButton title={t('common.save')} onPress={submit} loading={submitting} disabled={!amountValid} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
  err: { color: colors.danger, marginBottom: spacing(1.5) },
});
