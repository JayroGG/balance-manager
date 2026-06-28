import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useGetTransactionQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from '../../services/api/transactions';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import TransactionForm from './TransactionForm';
import { Screen, QueryBoundary, AppButton } from '../../components/ui';
import { spacing } from '../../components/theme';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const teamId = useActiveTeamId();
  const { canEditRow } = usePermissions();
  const { data, isLoading, error, refetch } = useGetTransactionQuery({ id, team_id: teamId });
  const { data: categories } = useGetCategoriesQuery(teamId);
  const [updateTransaction, { isLoading: saving, error: saveError }] = useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: deleting }] = useDeleteTransactionMutation();
  // RBAC: owner edits any row, member only their own, guest none (ADR-012). The API 403s a violation too.
  const canEdit = canEditRow(data);

  const onSubmit = async (body) => {
    try {
      await updateTransaction({ id, ...body, team_id: teamId }).unwrap();
      return true; // form shows the ✓ Saved lock; user stays on the screen
    } catch {
      return false;
    }
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
          } catch {}
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <QueryBoundary isLoading={isLoading && !data} error={error} onRetry={refetch}>
        <TransactionForm
          initial={data}
          categories={categories}
          onSubmit={onSubmit}
          submitting={saving}
          error={saveError}
          readOnly={!canEdit}
        />
        {canEdit ? (
          <AppButton
            title={t('common.delete')}
            variant="danger"
            onPress={onDelete}
            loading={deleting}
            style={{ margin: spacing(2) }}
          />
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}
