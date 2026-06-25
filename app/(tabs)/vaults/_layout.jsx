import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function VaultsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('vaults.title') }} />
      <Stack.Screen name="new" options={{ title: t('vaults.new'), presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: t('vaults.title') }} />
    </Stack>
  );
}
