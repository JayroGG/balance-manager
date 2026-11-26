import { Stack } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';

// Native headers are hidden app-wide — screens render their own ScreenHeader (ADR-013 congruence).
// contentStyle keeps push/modal transitions on the themed background.
// Dashboard cards block deep-links into settings/cards (cross-tab): back must land on the Settings list.
export const unstable_settings = { initialRouteName: 'index' };

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="cards" />
    </Stack>
  );
}
