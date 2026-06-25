import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TransactionsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('transactions.title') }} />
      <Stack.Screen name="new" options={{ title: t('transactions.new'), presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: t('transactions.edit') }} />
    </Stack>
  );
}
