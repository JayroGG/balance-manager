import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useGetTeamsQuery } from '../../services/api/teams';
import { setActiveTeam } from '../../reducers/context';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useActiveRole } from '../../hooks/useActiveRole';
import { useUnreadActivity } from '../../hooks/useUnreadActivity';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Card, Chip, MoneyText, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { DEFAULT_ACCENT, font, spacing } from '../../components/theme';

const VaultRow = ({ vault, currency }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const pct =
    vault.target && vault.target > 0 ? Math.min(1, (vault.balance ?? 0) / vault.target) : null;
  return (
    <Card>
      <View style={styles.vaultHead}>
        <Text style={styles.vaultName}>{vault.name}</Text>
        <MoneyText amount={vault.balance} currency={currency} style={styles.vaultBalance} />
      </View>
      {pct !== null ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>
          <MoneyText amount={vault.target} currency={currency} style={styles.vaultTarget} />
        </>
      ) : null}
    </Card>
  );
};

export default function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const teamId = useActiveTeamId();
  const role = useActiveRole(); // null in personal context; 'owner'|'member'|'guest' in a team
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: teams } = useGetTeamsQuery();
  const { data, isLoading, error, refetch } = useGetBalanceQuery(teamId);
  const unread = useUnreadActivity();
  // Drive the spinner only from a user pull — not the auto refetch-on-mount, which on iOS
  // leaves a programmatic RefreshControl spinner stuck until the user drags.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  const currency = data?.currency;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <ScreenHeader
        title={t('dashboard.title')}
        right={
          <Pressable hitSlop={10} testID="activity-link" onPress={() => router.push('/(tabs)/dashboard/activity')}>
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.switch}
      >
        <Chip
          label={t('context.personal')}
          active={teamId == null}
          dot={DEFAULT_ACCENT}
          onPress={() => dispatch(setActiveTeam(null))}
        />
        {teams?.map((team) => (
          <Chip
            key={team.id}
            label={team.name}
            active={teamId === team.id}
            dot={team.color ?? undefined}
            onPress={() => dispatch(setActiveTeam(team.id))}
          />
        ))}
      </ScrollView>

      {role ? (
        <Muted style={styles.roleBadge}>
          {t(`teams.role_${role}`)}
          {role === 'guest' ? ` · ${t('teams.readOnly')}` : ''}
        </Muted>
      ) : null}

      <QueryBoundary isLoading={isLoading && !data} error={error} onRetry={refetch}>
        <Card style={styles.hero}>
          <Text style={styles.heroLabel}>{t('dashboard.total')}</Text>
          <MoneyText amount={data?.total} currency={currency} style={styles.heroTotal} />
          <View style={styles.availRow}>
            <Text style={styles.heroLabel}>{t('dashboard.available')}</Text>
            <MoneyText amount={data?.available} currency={currency} style={styles.heroAvail} />
          </View>
        </Card>

        <SectionTitle>{t('dashboard.vaults')}</SectionTitle>
        {data?.vaults?.length ? (
          data.vaults.map((v) => <VaultRow key={v.id} vault={v} currency={currency} />)
        ) : (
          <Text style={styles.empty}>{t('dashboard.emptyVaults')}</Text>
        )}
      </QueryBoundary>
    </Screen>
  );
}

// Hero text derives from primaryText so it stays readable on ANY team accent (ADR-013).
const makeStyles = (colors) =>
  StyleSheet.create({
    switch: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing(1) },
    roleBadge: { marginBottom: spacing(1.5), textTransform: 'capitalize' },
    hero: { backgroundColor: colors.primary, padding: spacing(3) },
    heroLabel: { color: colors.primaryText, opacity: 0.85, fontSize: font.sm, fontWeight: '600' },
    heroTotal: { color: colors.primaryText, fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
    availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
    heroAvail: { color: colors.primaryText, fontSize: font.lg, fontWeight: '700' },
    vaultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    vaultName: { fontSize: font.md, fontWeight: '700', color: colors.text },
    vaultBalance: { fontSize: font.md, fontWeight: '700', color: colors.text },
    track: { height: 6, backgroundColor: colors.border, borderRadius: 999, marginTop: spacing(1.25), overflow: 'hidden' },
    fill: { height: 6, backgroundColor: colors.success, borderRadius: 999 },
    vaultTarget: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
    empty: { color: colors.muted, paddingVertical: spacing(2) },
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  });
