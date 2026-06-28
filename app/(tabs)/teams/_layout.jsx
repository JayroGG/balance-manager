import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TeamsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('teams.title') }} />
      <Stack.Screen name="[id]" options={{ title: t('teams.manage') }} />
    </Stack>
  );
}
