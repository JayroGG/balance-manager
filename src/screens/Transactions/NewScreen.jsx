import { Redirect, useRouter } from 'expo-router';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useAddTransactionMutation } from '../../services/api/transactions';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import TransactionForm from './TransactionForm';

export default function NewTransaction() {
  const router = useRouter();
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
    <TransactionForm
      categories={categories}
      onSubmit={onSubmit}
      submitting={isLoading}
      error={error}
    />
  );
}
