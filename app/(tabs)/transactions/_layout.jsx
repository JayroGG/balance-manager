import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../src/hooks/useTheme';

export default function TransactionsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme(); // native stack header follows the scheme + team accent (ADR-013)
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('transactions.title') }} />
      <Stack.Screen name="new" options={{ title: t('transactions.new'), presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: t('transactions.edit') }} />
    </Stack>
  );
}
