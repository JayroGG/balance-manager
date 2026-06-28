import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTransactionsQuery } from '../../services/api/transactions';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { Screen, Card, MoneyText, Chip, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';
import { formatDate } from '../../utils/dates';

const TYPE_FILTERS = ['all', 'income', 'expense'];

export default function TransactionsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [typeFilter, setTypeFilter] = useState('all');
  const filters = { team_id: teamId, ...(typeFilter === 'all' ? {} : { type: typeFilter }) };
  const { data, isLoading, error, refetch } = useGetTransactionsQuery(filters);
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;
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

  const renderItem = ({ item }) => {
    const income = item.type === 'income';
    return (
      <Link href={`/(tabs)/transactions/${item.id}`} asChild>
        <Pressable>
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.desc} numberOfLines={1}>{item.description || t(`transactions.${item.type}`)}</Text>
                <Text style={styles.meta}>{formatDate(item.occurred_at)}</Text>
              </View>
              <MoneyText
                amount={item.amount}
                currency={currency}
                style={[styles.amount, { color: income ? colors.success : colors.danger }]}
              />
            </View>
          </Card>
        </Pressable>
      </Link>
    );
  };

  return (
    <Screen padded={false}>
      <View style={styles.filters}>
        {TYPE_FILTERS.map((f) => (
          <Chip key={f} label={f === 'all' ? t('transactions.all') : t(`transactions.${f}`)} active={typeFilter === f} onPress={() => setTypeFilter(f)} />
        ))}
      </View>
      <QueryBoundary
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!!data && data.length === 0}
        emptyText={t('transactions.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      {canAdd ? (
        <Pressable style={styles.fab} onPress={() => router.push('/(tabs)/transactions/new')}>
          <Ionicons name="add" size={28} color={colors.primaryText} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing(2), paddingTop: spacing(1) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desc: { fontSize: font.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.25) },
  amount: { fontSize: font.md, fontWeight: '700', marginLeft: spacing(1) },
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
