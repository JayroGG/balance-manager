import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  useGetTransactionQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from '../../services/api/transactions';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useGetCardsQuery } from '../../services/api/cards';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import TransactionForm from './TransactionForm';
import { useGetBalanceQuery } from '../../services/api/balance';
import { isStepUpRequired, useGetTransfersQuery, useReverseTransferMutation } from '../../services/api/transfers';
import { useOwnedContexts } from '../../hooks/useOwnedContexts';
import { useStepUp } from '../../hooks/useStepUp';
import { selectMyUserId } from '../../reducers/auth';
import { isTransferRow, transferLabel, canRevertTransfer } from './transferRow';
import { formatDate } from '../../utils/dates';
import { Screen, ScreenHeader, QueryBoundary, MoneyText, Muted, AppButton } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../components/theme';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const teamId = useActiveTeamId();
  // This transaction id is scoped to the context it was opened in — leave the screen if it switches.
  useDismissOnContextChange();
  const { canEditRow } = usePermissions();
  const { data, isLoading, error, refetch } = useGetTransactionQuery({ id, team_id: teamId });
  const { data: categories } = useGetCategoriesQuery(teamId);
  const { data: balance } = useGetBalanceQuery(teamId);
  const { data: cards } = useGetCardsQuery(teamId);
  const [updateTransaction, { isLoading: saving, error: saveError }] = useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: deleting }] = useDeleteTransactionMutation();
  // RBAC: owner edits any row, member only their own, guest none (ADR-012). The API 403s a violation too.
  // card_payment rows are created only via Pay card; the BE rejects edits (400) — delete only (ADR-023).
  const isPayment = data?.type === 'card_payment';
  // Transfer rows (ADR-017) are read-only: no edit, no delete — only a real owner of both sides may revert.
  const isTransfer = isTransferRow(data);
  const myUserId = useSelector(selectMyUserId);
  const owned = useOwnedContexts();
  const { data: transfers } = useGetTransfersQuery({ team_id: teamId }, { skip: !isTransfer });
  const transfer = isTransfer ? transfers?.find((x) => x.id === data.transfer_id) : undefined;
  const reversal = transfer?.reversed_by != null ? transfers?.find((x) => x.id === transfer.reversed_by) : undefined;
  const canRevert = canRevertTransfer(transfer, owned, myUserId);
  const [reverseTransfer, { isLoading: reverting }] = useReverseTransferMutation();
  const { getPermit, stepUpModal } = useStepUp();
  const [revertError, setRevertError] = useState(null);
  const canEdit = canEditRow(data);

  const onSubmit = async (body) => {
    try {
      await updateTransaction({ id, ...body, team_id: teamId }).unwrap();
      return true; // form shows the ✓ Saved lock; user stays on the screen
    } catch {
      return false;
    }
  };

  const reverting_ = useRef(false);
  const doRevert = async () => {
    if (reverting_.current) return;
    reverting_.current = true;
    setRevertError(null);
    try {
      const permit = await getPermit();
      if (!permit) return; // user cancelled the identity check
      await reverseTransfer({ id: data.transfer_id, team_id: teamId, permit }).unwrap();
    } catch (e) {
      setRevertError(
        isStepUpRequired(e) ? t('transfers.stepUpExpired') : (e?.message ?? e?.data?.message ?? t('common.error')),
      );
    } finally {
      reverting_.current = false;
    }
  };

  const onRevert = () => {
    Alert.alert(t('transfers.revertConfirmTitle'), t('transfers.revertConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('transfers.revert'), style: 'destructive', onPress: doRevert },
    ]);
  };

  const onDelete = () => {
    Alert.alert(t('transactions.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction({ id, team_id: teamId }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader back title={t('transactions.edit')} style={styles.headerPad} />
      <QueryBoundary isLoading={isLoading && !data} error={error} onRetry={refetch}>
        {isTransfer ? (
          <View style={styles.payment} testID="transfer-readonly">
            <Muted>{transferLabel({ ...data, reversal_of: data.reversal_of ?? transfer?.reversal_of }, t)}</Muted>
            <MoneyText
              amount={data.type === 'transfer_out' ? -data.amount : data.amount}
              currency={balance?.currency}
              showCurrency="symbol"
              style={[styles.paymentAmount, { color: colors.text }]}
            />
            <Muted>{formatDate(data.occurred_at)}</Muted>
            {data.description ? <Muted>{data.description}</Muted> : null}
            <Muted>{t('transfers.readOnly')}</Muted>
            {transfer?.reversed_by != null ? (
              <View testID="transfer-reverted">
                <Text style={[styles.reverted, { color: colors.muted }]}>{t('transfers.reverted')}</Text>
                {reversal ? <Muted>{`${t('transfers.viewReversal')} · ${formatDate(reversal.occurred_at)}`}</Muted> : null}
              </View>
            ) : null}
            {revertError ? <Text style={{ color: colors.danger }} testID="revert-error">{revertError}</Text> : null}
            {canRevert ? (
              <AppButton title={t('transfers.revert')} variant="danger" onPress={onRevert} loading={reverting} />
            ) : null}
            {stepUpModal}
          </View>
        ) : isPayment ? (
          <View style={styles.payment} testID="card-payment-readonly">
            <Muted>{t('cards.payment')}</Muted>
            <MoneyText amount={data.amount} currency={balance?.currency} showCurrency="symbol" style={[styles.paymentAmount, { color: colors.text }]} />
            <Muted>{formatDate(data.occurred_at)}</Muted>
            {data.description ? <Muted>{data.description}</Muted> : null}
          </View>
        ) : (
        <TransactionForm
          initial={data}
          categories={categories}
          cards={cards}
          onSubmit={onSubmit}
          submitting={saving}
          error={saveError}
          readOnly={!canEdit}
        />
        )}
        {canEdit && !isTransfer ? (
          <Pressable onPress={onDelete} disabled={deleting} hitSlop={12} style={styles.deleteIcon}>
            {deleting ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={22} color={colors.danger} />}
          </Pressable>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
  payment: { padding: spacing(2), alignItems: 'center', gap: spacing(1) },
  reverted: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  paymentAmount: { fontSize: 28, fontWeight: '800' },
  deleteIcon: { alignSelf: 'center', padding: spacing(2), marginTop: spacing(1), minWidth: 44, minHeight: 44 },
});
