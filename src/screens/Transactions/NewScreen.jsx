import { useRouter } from 'expo-router';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useAddTransactionMutation } from '../../services/api/transactions';
import TransactionForm from './TransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const { data: categories } = useGetCategoriesQuery();
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
      onSubmit={onSubmit}
      submitting={isLoading}
      error={error}
    />
  );
}
