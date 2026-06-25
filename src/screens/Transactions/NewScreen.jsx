import { useRouter } from 'expo-router';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useGetVaultsQuery } from '../../services/api/vaults';
import { useAddTransactionMutation } from '../../services/api/transactions';
import TransactionForm from './TransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const { data: categories } = useGetCategoriesQuery();
  const { data: vaults } = useGetVaultsQuery();
  const [addTransaction, { isLoading, error }] = useAddTransactionMutation();

  const onSubmit = async (body) => {
    try {
      await addTransaction(body).unwrap();
      router.back();
    } catch {
      // error surfaced via the `error` prop below
    }
  };

  return (
    <TransactionForm
      categories={categories}
      vaults={vaults}
      onSubmit={onSubmit}
      submitting={isLoading}
      error={error}
    />
  );
}
