import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetCardsQuery } from '../../services/api/cards';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { useContextReady } from '../../hooks/useContextReady';
import { Screen, ScreenHeader, Card, MoneyText, QueryBoundary, StaleBadge } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDate, todayISODate } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

// Overdue = a past due date with an unpaid statement (the BE never rolls due_date forward).
export const isOverdue = (card) => card.statement_balance > 0 && !!card.due_date && card.due_date < todayISODate();

export default function CardsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const cardsQuery = useGetCardsQuery(teamId);
  const { data: cards, isLoading, error, refetch } = cardsQuery;
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;
  // ADR-019: an unconfirmed context is treated as still-loading — never render owed figures under it.
  const { confirmed, stale, offline, lastUpdated } = useContextReady(cardsQuery);
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
    const overdue = isOverdue(item);
    return (
      <Link href={`/(tabs)/settings/cards/${item.id}`} asChild>
        <Pressable style={styles.row}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              <MoneyText amount={item.owed} currency={currency} style={styles.owed} showCurrency="symbol" />
            </View>
            <Text style={styles.subline}>{t('cards.owed')}</Text>
            {item.statement_balance > 0 ? (
              <Text style={[styles.subline, overdue && styles.overdue]}>
                {t('cards.payBy', {
                  amount: formatMoney(item.statement_balance, currency, { showCurrency: 'symbol' }),
                  date: formatDate(item.due_date),
                })}
              </Text>
            ) : (
              <Text style={styles.subline}>{t('cards.nothingDue')}</Text>
            )}
            {overdue ? (
              <Text style={[styles.subline, styles.overdue]}>{t('cards.overdue', { date: formatDate(item.due_date) })}</Text>
            ) : null}
          </Card>
        </Pressable>
      </Link>
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader
        back
        title={t('cards.title')}
        style={styles.headerPad}
        right={confirmed && stale ? <StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.muted} /> : null}
      />
      <QueryBoundary
        isLoading={(isLoading && !cards) || !confirmed}
        error={error}
        isEmpty={!!cards && cards.length === 0}
        emptyText={t('cards.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={cards}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      {canAdd ? (
        <Pressable
          style={styles.fab}
          accessibilityLabel={t('cards.new')}
          onPress={() => router.push('/(tabs)/settings/cards/new')}
        >
          <Ionicons name="add" size={28} color={colors.primaryText} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
    row: { minHeight: 44 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: font.md, fontWeight: '700', color: colors.text },
    owed: { fontSize: font.md, fontWeight: '700', color: colors.text },
    subline: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
    overdue: { color: colors.danger },
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
