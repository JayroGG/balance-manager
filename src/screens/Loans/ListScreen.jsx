import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetLoansQuery } from '../../services/api/loans';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { Screen, ScreenHeader, Card, MoneyText, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

export default function LoansList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const { data: loans, isLoading, error, refetch } = useGetLoansQuery(teamId);
  // Per-loan pending/repaid figures come from /balance (mirrors vaults' balance/target join).
  const { data: balance, refetch: refetchBalance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;
  // Drive the spinner only from a user pull — not the auto refetch-on-mount, which on iOS
  // leaves a programmatic RefreshControl spinner stuck until the user drags.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchBalance()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchBalance]);

  const renderItem = ({ item }) => {
    const figures = balance?.loans?.find((l) => l.id === item.id);
    const totalLent = figures?.amount ?? item.amount ?? 0;
    const pending = figures?.pending ?? item.pending ?? 0;
    const repaid = totalLent - pending;
    const pct = totalLent > 0 ? Math.min(1, repaid / totalLent) : null;
    return (
      <Link href={`/(tabs)/loans/${item.id}`} asChild>
        <Pressable>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              <MoneyText amount={pending} currency={currency} style={styles.pending} />
            </View>
            {pct !== null ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
            ) : null}
            <Text style={styles.subline}>
              {t('loans.totalLent')}: <MoneyText amount={totalLent} currency={currency} /> ·{' '}
              {t('loans.repaid')}: <MoneyText amount={repaid} currency={currency} />
            </Text>
          </Card>
        </Pressable>
      </Link>
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('loans.title')} style={styles.headerPad} />
      <QueryBoundary
        isLoading={isLoading && !loans}
        error={error}
        isEmpty={!!loans && loans.length === 0}
        emptyText={t('loans.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={loans}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      {canAdd ? (
        <Pressable style={styles.fab} onPress={() => router.push('/(tabs)/loans/new')}>
          <Ionicons name="add" size={28} color={colors.primaryText} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  pending: { fontSize: font.md, fontWeight: '700', color: colors.text },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 999, marginTop: spacing(1.25), overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.success, borderRadius: 999 },
  subline: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
  fab: {
    position: 'absolute',
    right: spacing(2.5),
    bottom: spacing(3),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
