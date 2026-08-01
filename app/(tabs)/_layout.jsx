import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed } from '../../src/reducers/auth';
import { selectActiveTeamId, setActiveTeam } from '../../src/reducers/context';
import { useGetTeamsQuery } from '../../src/services/api/teams';
import { useTheme } from '../../src/hooks/useTheme';
import { BrandSpinner } from '../../src/components/ui';
import { spacing } from '../../src/components/theme';

const icon =
  (name) =>
  ({ color, size }) =>
    <Ionicons name={name} color={color} size={size} />;

// ADR-019 Task 7: is the GET /teams roster fetch below still an unanswered first load?
const isFetchError = (error) =>
  error?.status === 'FETCH_ERROR' || error?.status === 'TIMEOUT_ERROR';

export default function TabsLayout() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // Runtime guard: a 401 or logout clears auth → bounce out of the tabs. (Cold start is handled by
  // app/index.jsx's boot redirect.)
  const authed = useSelector(selectIsAuthed);
  const activeTeamId = useSelector(selectActiveTeamId);
  const { colors } = useTheme(); // team accent + scheme → the tab bar re-tints on context switch (ADR-013)
  const { data: teams, error: teamsError, isLoading, isUninitialized } = useGetTeamsQuery(undefined, {
    skip: !authed,
  });
  const styles = makeStyles(colors);

  // If the active team disappears (deleted, or you were removed), fall back to personal — otherwise the
  // stale ?team_id= keeps 403/404-ing and the dashboard sits on a phantom context. (ADR-012)
  useEffect(() => {
    if (activeTeamId != null && teams && !teams.some((tm) => tm.id === activeTeamId)) {
      dispatch(setActiveTeam(null));
    }
  }, [activeTeamId, teams, dispatch]);

  if (!authed) return <Redirect href="/(auth)/login" />;

  // Boot session probe (ADR-019): this GET /teams is already the app's only roster fetch — promote it
  // to the gate instead of adding a second request. Hold the tabs (not the whole app; app/_layout's
  // AnimatedSplash overlay still handles the splash→app handoff on top of this) only when ALL of:
  //   - a team is active (personal needs no roster lookup — never gate it)
  //   - there is no cached roster yet (cached data = the offline path; let screens through so they can
  //     render cached figures behind a StaleBadge via useContextReady)
  //   - the query is genuinely still on its first load (isUninitialized/isLoading, no data)
  //   - the failure isn't FETCH_ERROR/TIMEOUT_ERROR — an offline first-load-with-no-cache must fall
  //     through to the screens' own skeleton + offline handling rather than trap the user on a spinner
  const awaitingContext =
    activeTeamId != null && !teams && (isUninitialized || isLoading) && !isFetchError(teamsError);

  if (awaitingContext) {
    return (
      <View style={styles.probe}>
        <BrandSpinner />
        <Text style={styles.probeText}>{t('common.confirmingContext')}</Text>
      </View>
    );
  }

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
      <Tabs.Screen name="loans" options={{ title: t('tabs.loans'), tabBarIcon: icon('cash-outline') }} />
      <Tabs.Screen name="teams" options={{ title: t('tabs.teams'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    probe: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      gap: spacing(1.5),
    },
    probeText: { color: colors.muted },
  });
