import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useGetTransactionQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from '../../../src/services/api/transactions';
import { useGetCategoriesQuery } from '../../../src/services/api/categories';
import { useGetVaultsQuery } from '../../../src/services/api/vaults';
import TransactionForm from '../../../src/components/TransactionForm';
import { Screen, QueryBoundary, AppButton } from '../../../src/components/ui';
import { spacing } from '../../../src/components/theme';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useGetTransactionQuery(id);
  const { data: categories } = useGetCategoriesQuery();
  const { data: vaults } = useGetVaultsQuery();
  const [updateTransaction, { isLoading: saving, error: saveError }] = useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: deleting }] = useDeleteTransactionMutation();

  const onSubmit = async (body) => {
    try {
      await updateTransaction({ id, ...body }).unwrap();
      router.back();
    } catch {}
  };

  const onDelete = () => {
    Alert.alert(t('transactions.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id).unwrap();
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
          vaults={vaults}
          onSubmit={onSubmit}
          submitting={saving}
          error={saveError}
        />
        <AppButton
          title={t('common.delete')}
          variant="danger"
          onPress={onDelete}
          loading={deleting}
          style={{ margin: spacing(2) }}
        />
      </QueryBoundary>
    </Screen>
  );
}
