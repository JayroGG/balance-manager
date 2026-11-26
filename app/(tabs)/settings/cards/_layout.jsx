import { Stack } from 'expo-router';
import { useTheme } from '../../../../src/hooks/useTheme';

// Native headers are hidden app-wide — screens render their own ScreenHeader (ADR-013 congruence).
export const unstable_settings = { initialRouteName: 'index' };

export default function CardsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
