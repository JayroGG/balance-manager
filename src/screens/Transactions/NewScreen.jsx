import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useAddTransactionMutation } from '../../services/api/transactions';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import TransactionForm from './TransactionForm';
import { Screen, ScreenHeader } from '../../components/ui';
import { spacing } from '../../components/theme';

export default function NewTransaction() {
  const router = useRouter();
  const { t } = useTranslation();
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const { data: categories } = useGetCategoriesQuery(teamId);
  const [addTransaction, { isLoading, error }] = useAddTransactionMutation();
  // Drop the half-filled form if the context switches — it would create in the wrong context.
  useDismissOnContextChange();

  // Guard the deep-link path: the FAB is already hidden when the user can't add (ADR-012).
  if (!canAdd) return <Redirect href="/(tabs)/transactions" />;

  const onSubmit = async (body) => {
    try {
      await addTransaction({ ...body, team_id: teamId }).unwrap();
      router.back();
    } catch {
      // error surfaced via the `error` prop below
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader back title={t('transactions.new')} style={{ paddingHorizontal: spacing(2), marginBottom: 0 }} />
      <TransactionForm
        categories={categories}
        onSubmit={onSubmit}
        submitting={isLoading}
        error={error}
      />
    </Screen>
  );
}
