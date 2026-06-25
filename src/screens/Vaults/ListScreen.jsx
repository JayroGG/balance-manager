import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { Screen, Card, MoneyText, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';

export default function VaultsList() {
  const { t } = useTranslation();
  const router = useRouter();
  // Per-vault balances/targets come from /balance (PRD note).
  const { data, isLoading, isFetching, error, refetch } = useGetBalanceQuery();
  const currency = data?.currency;
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const renderItem = ({ item }) => {
    const pct = item.target && item.target > 0 ? Math.min(1, (item.balance ?? 0) / item.target) : null;
    return (
      <Link href={`/(tabs)/vaults/${item.id}`} asChild>
        <Pressable>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              <MoneyText amount={item.balance} currency={currency} style={styles.balance} />
            </View>
            {pct !== null ? (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.target}>
                  {t('vaults.target')}: <MoneyText amount={item.target} currency={currency} />
                </Text>
              </>
            ) : (
              <Text style={styles.target}>{t('vaults.noTarget')}</Text>
            )}
          </Card>
        </Pressable>
      </Link>
    );
  };

  return (
    <Screen padded={false}>
      <QueryBoundary
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!!data && (data.vaults?.length ?? 0) === 0}
        emptyText={t('vaults.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={data?.vaults}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={isFetching && !!data} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      <Pressable style={styles.fab} onPress={() => router.push('/(tabs)/vaults/new')}>
        <Ionicons name="add" size={28} color={colors.primaryText} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  balance: { fontSize: font.md, fontWeight: '700', color: colors.text },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 999, marginTop: spacing(1.25), overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.success, borderRadius: 999 },
  target: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
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
