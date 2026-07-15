import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetLoanQuery,
  useGetLoanHistoryQuery,
  useUpdateLoanMutation,
  useDeleteLoanMutation,
  useLendLoanMutation,
  useRepayLoanMutation,
} from '../../services/api/loans';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Screen, ScreenHeader, Card, MoneyText, AppButton, Field, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDateTime } from '../../utils/dates';

export default function LoanDetail() {
  const { id } = useLocalSearchParams();
  const loanId = Number(id);
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  // This loan id is scoped to the context it was opened in — leave the screen if the context switches.
  useDismissOnContextChange();
  const { canEditRow } = usePermissions();

  const { data: balance } = useGetBalanceQuery(teamId);
  const { data: loan, isLoading, error, refetch } = useGetLoanQuery({ id, team_id: teamId });
  const { data: history } = useGetLoanHistoryQuery({ id, team_id: teamId });
  const currency = balance?.currency;
  const figures = balance?.loans?.find((l) => l.id === loanId);
  // RBAC: owner edits any loan, member only their own, guest none — gate repay/lend/save/delete
  // (the API 403s a violation too). History + balances stay visible to all roles (ADR-012).
  const canEdit = canEditRow(loan);

  const totalLent = figures?.amount ?? loan?.amount ?? 0;
  const pending = figures?.pending ?? loan?.pending ?? 0;
  const repaid = totalLent - pending;
  const pct = totalLent > 0 ? Math.min(1, repaid / totalLent) : null;

  // Repay/lend move an amount between the loan and spendable (mirrors vault allocate/withdraw, ADR-009).
  const [picker, setPicker] = useState(null); // null | 'repay' | 'lend'
  const [amount, setAmount] = useState('');
  const [flashed, setFlashed] = useState(null); // 'repay' | 'lend' — transient ✓ on the action button
  const flashRef = useRef();
  useEffect(() => () => clearTimeout(flashRef.current), []);
  const triggerFlash = (action) => {
    setFlashed(action);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashed(null), 1500);
  };

  const [repayLoan, { isLoading: repaying }] = useRepayLoanMutation();
  const [lendLoan, { isLoading: lending }] = useLendLoanMutation();
  const [updateLoan, { isLoading: saving }] = useUpdateLoanMutation();
  const [deleteLoan, { isLoading: deleting }] = useDeleteLoanMutation();

  const [name, setName] = useState('');
  // Seed the edit field once the loan loads.
  useEffect(() => {
    if (loan) setName(loan.name ?? '');
  }, [loan]);

  // Save shows only while name differs from the saved loan.
  const dirty = !loan || name.trim() !== (loan.name ?? '');

  // Amount bounds mirror the backend: repay ≤ pending, lend ≤ available (it 400s otherwise).
  const available = balance?.available ?? 0;
  const max = picker === 'repay' ? pending : available;
  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0 && amountNum <= max;

  const openPicker = (next) => {
    setAmount('');
    setPicker(picker === next ? null : next);
  };

  const onConfirm = async () => {
    const action = picker;
    try {
      if (action === 'repay') await repayLoan({ id: loanId, amount: amountNum, team_id: teamId }).unwrap();
      else await lendLoan({ id: loanId, amount: amountNum, team_id: teamId }).unwrap();
      setPicker(null);
      setAmount('');
      triggerFlash(action);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onSave = async () => {
    try {
      await updateLoan({ id: loanId, name: name.trim(), team_id: teamId }).unwrap();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  // A loan can only be deleted once its pending amount is fully collected (backend 400s otherwise).
  const canDelete = pending <= 0;
  const onDelete = () => {
    Alert.alert(t('loans.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLoan({ id: loanId, team_id: teamId }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('loans.title')} />
      <QueryBoundary isLoading={isLoading && !loan} error={error} onRetry={refetch}>
        <Card style={styles.hero}>
          <Text style={styles.name}>{figures?.name ?? loan?.name}</Text>
          <MoneyText amount={pending} currency={currency} style={styles.pending} />
          {pct !== null ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
              <Text style={styles.subline}>
                {t('loans.repaid')} <MoneyText amount={repaid} currency={currency} /> · {t('loans.totalLent')}{' '}
                <MoneyText amount={totalLent} currency={currency} />
              </Text>
            </>
          ) : null}
        </Card>

        {canEdit ? (
          <View style={styles.actions}>
            <AppButton
              title={t('loans.repay')}
              successTitle={t('loans.repayDone')}
              success={flashed === 'repay'}
              onPress={() => openPicker('repay')}
              style={{ flex: 1, marginRight: spacing(1) }}
            />
            <AppButton
              title={t('loans.lend')}
              successTitle={t('loans.lendDone')}
              success={flashed === 'lend'}
              variant="ghost"
              onPress={() => openPicker('lend')}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {canEdit && picker ? (
          <Card>
            <Muted>{picker === 'repay' ? t('loans.repayHint') : t('loans.lendHint')}</Muted>
            <Field
              label={t('loans.amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Muted style={styles.maxHint}>
              {picker === 'repay' ? t('loans.pending') : t('dashboard.available')}:{' '}
              <MoneyText amount={max} currency={currency} />
            </Muted>
            <AppButton
              title={t('common.confirm')}
              onPress={onConfirm}
              loading={repaying || lending}
              disabled={!amountValid}
            />
          </Card>
        ) : null}

        <SectionTitle>{t('loans.history')}</SectionTitle>
        {history?.length ? (
          history.map((h) => (
            <Card key={h.id}>
              <View style={styles.rowBetween}>
                <Text style={[styles.action, { color: h.action === 'repay' ? colors.success : colors.danger }]}>
                  {t(`loans.${h.action}`)}
                </Text>
                <MoneyText amount={h.amount} currency={currency} style={styles.histAmount} />
              </View>
              <Text style={styles.histDate}>{formatDateTime(h.created_at)}</Text>
            </Card>
          ))
        ) : (
          <Muted>{t('loans.noHistory')}</Muted>
        )}

        {canEdit ? (
          <>
            <SectionTitle>{t('common.edit')}</SectionTitle>
            <Field label={t('loans.name')} value={name} onChangeText={setName} />
            {/* Save only when there's a valid unsaved change; it hides again once saved. */}
            {dirty && name.trim() ? (
              <AppButton title={t('common.save')} onPress={onSave} loading={saving} />
            ) : null}
            {/* A loan deletes only once its pending amount is collected — show a small trash icon, else the reason. */}
            {canDelete ? (
              <Pressable onPress={onDelete} disabled={deleting} hitSlop={12} style={styles.deleteIcon}>
                {deleting ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={22} color={colors.danger} />}
              </Pressable>
            ) : (
              <Muted style={styles.deleteHint}>{t('loans.deleteNeedsZero')}</Muted>
            )}
          </>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

// Hero text derives from primaryText so it stays readable on ANY team accent (ADR-013).
const makeStyles = (colors) =>
  StyleSheet.create({
  hero: { backgroundColor: colors.primary, padding: spacing(3) },
  name: { color: colors.primaryText, opacity: 0.85, fontSize: font.md, fontWeight: '700' },
  pending: { color: colors.primaryText, fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
  // primaryText is always a 6-digit hex (contrastOn), so a hex-alpha suffix stays readable on ANY accent.
  track: { height: 6, backgroundColor: `${colors.primaryText}40`, borderRadius: 999, marginTop: spacing(1.5), overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.primaryText, borderRadius: 999 },
  subline: { color: colors.primaryText, opacity: 0.85, fontSize: font.sm, marginTop: spacing(1) },
  actions: { flexDirection: 'row', marginVertical: spacing(1.5) },
  maxHint: { marginBottom: spacing(1.5) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontWeight: '700', fontSize: font.md },
  histAmount: { fontWeight: '700', color: colors.text },
  histDate: { color: colors.muted, fontSize: font.sm, marginTop: spacing(0.5) },
  deleteIcon: { alignSelf: 'center', padding: spacing(2), marginTop: spacing(1) },
  deleteHint: { textAlign: 'center', marginTop: spacing(1.5) },
});
