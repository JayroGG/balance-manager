import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed } from '../../src/reducers/auth';
import { selectActiveTeamId, setActiveTeam } from '../../src/reducers/context';
import { useGetTeamsQuery } from '../../src/services/api/teams';
import { useTheme } from '../../src/hooks/useTheme';

const icon =
  (name) =>
  ({ color, size }) =>
    <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // Runtime guard: a 401 or logout clears auth → bounce out of the tabs. (Cold start is handled by
  // app/index.jsx's boot redirect.)
  const authed = useSelector(selectIsAuthed);
  const activeTeamId = useSelector(selectActiveTeamId);
  const { colors } = useTheme(); // team accent + scheme → the tab bar re-tints on context switch (ADR-013)
  const { data: teams } = useGetTeamsQuery(undefined, { skip: !authed });

  // If the active team disappears (deleted, or you were removed), fall back to personal — otherwise the
  // stale ?team_id= keeps 403/404-ing and the dashboard sits on a phantom context. (ADR-012)
  useEffect(() => {
    if (activeTeamId != null && teams && !teams.some((tm) => tm.id === activeTeamId)) {
      dispatch(setActiveTeam(null));
    }
  }, [activeTeamId, teams, dispatch]);

  if (!authed) return <Redirect href="/(auth)/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: t('tabs.dashboard'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="transactions" options={{ title: t('tabs.transactions'), tabBarIcon: icon('swap-horizontal-outline') }} />
      <Tabs.Screen name="vaults" options={{ title: t('tabs.vaults'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="categories" options={{ title: t('tabs.categories'), tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="teams" options={{ title: t('tabs.teams'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
