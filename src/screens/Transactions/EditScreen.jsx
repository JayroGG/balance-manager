import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetTransactionQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from '../../services/api/transactions';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import TransactionForm from './TransactionForm';
import { Screen, QueryBoundary } from '../../components/ui';
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
          <Pressable onPress={onDelete} disabled={deleting} hitSlop={12} style={styles.deleteIcon}>
            {deleting ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={22} color={colors.danger} />}
          </Pressable>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  deleteIcon: { alignSelf: 'center', padding: spacing(2), marginTop: spacing(1) },
});
