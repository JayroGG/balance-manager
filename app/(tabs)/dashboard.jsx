import { useCallback } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../src/services/api/balance';
import { Screen, Card, MoneyText, SectionTitle, QueryBoundary } from '../../src/components/ui';
import { colors, font, spacing } from '../../src/components/theme';

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
  const { data, isLoading, isFetching, error, refetch } = useGetBalanceQuery();
  const onRefresh = useCallback(() => refetch(), [refetch]);
  const currency = data?.currency;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isFetching && !!data} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>{t('dashboard.title')}</Text>
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
