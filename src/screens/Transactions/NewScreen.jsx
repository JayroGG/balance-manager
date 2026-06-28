import { useRouter } from 'expo-router';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useAddTransactionMutation } from '../../services/api/transactions';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import TransactionForm from './TransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const teamId = useActiveTeamId();
  const { data: categories } = useGetCategoriesQuery(teamId);
  const [addTransaction, { isLoading, error }] = useAddTransactionMutation();

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
