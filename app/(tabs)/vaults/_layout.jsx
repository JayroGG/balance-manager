import { Stack } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';

// Anchor the stack on `index` so a cross-tab deep link (e.g. the Dashboard vault-card shortcut
// navigating to `[id]`) always sits ON TOP of the vault list instead of orphaning the tab with no
// way back. Without this, entering the tab via a deep link strands it on the pushed screen (#17).
export const unstable_settings = { initialRouteName: 'index' };

// Native headers are hidden app-wide — screens render their own ScreenHeader (ADR-013 congruence).
// contentStyle keeps push/modal transitions on the themed background.
export default function VaultsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
