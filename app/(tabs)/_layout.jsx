import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed } from '../../src/reducers/auth';
import { colors } from '../../src/components/theme';

const icon =
  (name) =>
  ({ color, size }) =>
    <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { t } = useTranslation();
  // Runtime guard: a 401 or logout clears auth → bounce out of the tabs. (Cold start is handled by
  // app/index.jsx's boot redirect.)
  const authed = useSelector(selectIsAuthed);
  if (!authed) return <Redirect href="/(auth)/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: t('tabs.dashboard'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="transactions" options={{ title: t('tabs.transactions'), tabBarIcon: icon('swap-horizontal-outline') }} />
      <Tabs.Screen name="vaults" options={{ title: t('tabs.vaults'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="categories" options={{ title: t('tabs.categories'), tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
