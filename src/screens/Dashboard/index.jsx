import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useGetTeamsQuery } from '../../services/api/teams';
import { setActiveTeam } from '../../reducers/context';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useActiveRole } from '../../hooks/useActiveRole';
import { Screen, Card, Chip, MoneyText, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';

const VaultRow = ({ vault, currency }) => {
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
  const teamId = useActiveTeamId();
  const role = useActiveRole(); // null in personal context; 'owner'|'member'|'guest' in a team
  const { data: teams } = useGetTeamsQuery();
  const { data, isLoading, error, refetch } = useGetBalanceQuery(teamId);
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
      <Text style={styles.h1}>{t('dashboard.title')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.switch}
      >
        <Chip
          label={t('context.personal')}
          active={teamId == null}
          onPress={() => dispatch(setActiveTeam(null))}
        />
        {teams?.map((team) => (
          <Chip
            key={team.id}
            label={team.name}
            active={teamId === team.id}
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

const styles = StyleSheet.create({
  h1: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginVertical: spacing(1.5) },
  switch: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing(1) },
  roleBadge: { marginBottom: spacing(1.5), textTransform: 'capitalize' },
  hero: { backgroundColor: colors.primary, padding: spacing(3) },
  heroLabel: { color: '#DBEAFE', fontSize: font.sm, fontWeight: '600' },
  heroTotal: { color: '#FFFFFF', fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
  heroAvail: { color: '#FFFFFF', fontSize: font.lg, fontWeight: '700' },
  vaultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vaultName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  vaultBalance: { fontSize: font.md, fontWeight: '700', color: colors.text },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 999, marginTop: spacing(1.25), overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.success, borderRadius: 999 },
  vaultTarget: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
  empty: { color: colors.muted, paddingVertical: spacing(2) },
});
