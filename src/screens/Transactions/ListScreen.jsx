import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTransactionsInfiniteQuery } from '../../services/api/transactions';
import { useGetCardsQuery } from '../../services/api/cards';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { useTheme } from '../../hooks/useTheme';
import { useContextReady } from '../../hooks/useContextReady';
import { Screen, ScreenHeader, Card, MoneyText, Chip, CyclingFigure, QueryBoundary, Skeleton, StaleBadge, EmptyState, AppButton } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { formatDate, filterRange } from '../../utils/dates';
import { DateFilter, ALL_TIME, dateFilterLabel } from './DateFilter';
import { FilterMenu } from './FilterMenu';
import { isTransferRow, transferLabel } from './transferRow';

const TYPE_FILTERS = ['all', 'income', 'expense', 'loans'];

const SEARCH_DEBOUNCE_MS = 300;

export default function TransactionsList() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [typeFilter, setTypeFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState(null);
  const [cardMenu, setCardMenu] = useState(false);
  const [sortDir, setSortDir] = useState('desc');
  const [dateFilter, setDateFilter] = useState(ALL_TIME);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  // Every filter goes to the server in one query (ADR-021); the 'loans' chip maps to loans=only.
  const { from, to } = filterRange(dateFilter);
  const filters = {
    team_id: teamId,
    q,
    from,
    to,
    sort: sortDir,
    ...(cardFilter != null ? { card_id: cardFilter } : {}),
    ...(typeFilter === 'loans' ? { loans: 'only' } : typeFilter === 'all' ? {} : { type: typeFilter }),
  };
  const txQuery = useGetTransactionsInfiniteQuery(filters);
  const { currentData, isFetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = txQuery;
  const { data: cards } = useGetCardsQuery(teamId);
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;
  // The totals bar is a fixed-geometry figure — it must never paint under an unconfirmed context
  // (ADR-019). Staleness/lastUpdated describe this screen's own money data (the transactions query).
  const { confirmed, stale, offline, lastUpdated } = useContextReady(txQuery);

  const items = useMemo(() => currentData?.pages.flatMap((p) => p.items) ?? [], [currentData]);
  // Server totals for the whole filtered set (loan journal rows already excluded) — first page only.
  // `currentData` (not `data`): while a new filter loads, `data` still holds the previous filter's
  // result — its totals must not pass for the new set. Same fixed-geometry skeleton as ADR-019.
  const totals = currentData?.pages[0]?.totals;
  const hasFilters = q !== '' || dateFilter.kind !== 'all' || typeFilter !== 'all' || cardFilter != null;
  const cardFilterName = cardFilter != null ? cards?.find((c) => c.id === cardFilter)?.name ?? t('cards.card') : null;
  const activeFilters = [
    ...(cardFilter != null ? [{ key: 'card', label: cardFilterName, clear: () => setCardFilter(null) }] : []),
    ...(dateFilter.kind !== 'all'
      ? [{ key: 'date', label: dateFilterLabel(dateFilter, t, i18n.language), clear: () => setDateFilter(ALL_TIME) }]
      : []),
  ];
  const resetFilters = () => {
    setSearch('');
    setQ('');
    setDateFilter(ALL_TIME);
    setTypeFilter('all');
    setCardFilter(null);
  };

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

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetching && !error) fetchNextPage();
  }, [hasNextPage, isFetching, error, fetchNextPage]);

  const renderItem = ({ item }) => {
    const income = item.type === 'income';
    const payment = item.type === 'card_payment';
    const transfer = isTransferRow(item);
    const cardName = item.card_id != null ? cards?.find((c) => c.id === item.card_id)?.name ?? t('cards.card') : null;
    return (
      <Link href={`/(tabs)/transactions/${item.id}`} asChild>
        <Pressable>
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.descRow}>
                  {item.type === 'expense' ? (
                    cardName ? (
                      <Ionicons
                        name="card"
                        size={16}
                        color={colors.cardAccent}
                        style={styles.payIcon}
                        testID={`pay-icon-card-${item.id}`}
                        accessibilityLabel={cardName}
                      />
                    ) : (
                      <Text style={styles.cashIcon} testID={`pay-icon-cash-${item.id}`} accessibilityLabel={t('cards.cash')}>$</Text>
                    )
                  ) : null}
                  <Text style={[styles.desc, { flexShrink: 1 }]} numberOfLines={1}>{transfer ? transferLabel(item, t) : item.description || (payment ? t('cards.payment') : t(`transactions.${item.type}`))}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{formatDate(item.occurred_at)}{payment && cardName ? ` · ${cardName}` : ''}</Text>
                  {item.loan_id != null ? (
                    <View style={styles.loanBadge}>
                      <Text style={styles.loanBadgeText}>{t('transactions.loan')}</Text>
                    </View>
                  ) : null}
                </View>
                {item.categories?.length ? (
                  <Text style={styles.meta} numberOfLines={1} testID={`categories-${item.id}`}>
                    {item.categories.map((c) => c.name).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <MoneyText
                amount={transfer && item.type === 'transfer_out' ? -item.amount : item.amount}
                currency={currency}
                showCurrency="symbol"
                style={[styles.amount, { color: payment || transfer ? colors.muted : income ? colors.success : colors.danger }]}
              />
            </View>
          </Card>
        </Pressable>
      </Link>
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={t('transactions.title')}
        style={styles.headerPad}
        right={
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={12}
              testID="sort-toggle"
              accessibilityLabel={t(sortDir === 'desc' ? 'transactions.sortNewest' : 'transactions.sortOldest')}
              onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            >
              <Ionicons name={sortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={24} color={colors.primary} />
            </Pressable>
            <Pressable hitSlop={12} testID="lists-link" onPress={() => router.push('/(tabs)/transactions/lists')}>
              <Ionicons name="cart-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.searchRow}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('transactions.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search !== '' ? (
          <Pressable hitSlop={12} testID="search-clear" accessibilityLabel={t('transactions.clearSearch')} onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {cards?.length ? (
        <Pressable
          testID="card-filter-button"
          style={[styles.iconButton, cardFilter != null && styles.iconButtonActive]}
          accessibilityRole="button"
          accessibilityLabel={t('cards.filterByCard')}
          accessibilityState={{ selected: cardFilter != null }}
          onPress={() => setCardMenu(true)}
        >
          <Ionicons name="card-outline" size={22} color={cardFilter != null ? colors.cardAccent : colors.muted} />
        </Pressable>
      ) : null}
      <DateFilter value={dateFilter} onChange={setDateFilter} />
      </View>

      <FilterMenu
        visible={cardMenu}
        onClose={() => setCardMenu(false)}
        testID="card-menu"
        options={[
          { key: 'all', label: t('cards.allCards'), selected: cardFilter == null },
          ...(cards ?? []).map((c) => ({ key: String(c.id), label: c.name, selected: cardFilter === c.id })),
        ]}
        onSelect={(key) => {
          setCardFilter(key === 'all' ? null : Number(key));
          setCardMenu(false);
        }}
      />

      <View style={styles.filters}>
        {TYPE_FILTERS.map((f) => (
          <Chip key={f} label={f === 'all' ? t('transactions.all') : t(`transactions.${f}`)} active={typeFilter === f} onPress={() => setTypeFilter(f)} />
        ))}
      </View>

      {activeFilters.length ? (
        <View style={styles.activeFilters} testID="active-filters">
          {activeFilters.map((f) => (
            <View key={f.key} style={styles.activeRow}>
              <Text style={styles.activeText} numberOfLines={1} testID={`active-filter-${f.key}`}>
                {t('transactions.filteringBy', { label: f.label })}
              </Text>
              <Pressable
                style={styles.clearX}
                testID={`clear-filter-${f.key}`}
                accessibilityRole="button"
                accessibilityLabel={t('transactions.clearFilter', { label: f.label })}
                onPress={f.clear}
              >
                <Ionicons name="close" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.totals}>
        {confirmed && totals ? (
          <>
            <CyclingFigure
              testID="totals-cycle"
              currency={currency}
              dotColor={colors.muted}
              labelStyle={styles.totalLabel}
              valueStyle={styles.totalValue}
              steps={[
                { key: 'net', label: t('transactions.net'), amount: totals.net, color: colors.text, signed: true },
                { key: 'income', label: t('transactions.income'), amount: totals.income, color: colors.success },
                { key: 'expense', label: t('transactions.expense'), amount: totals.expense, color: colors.danger },
                // Charges are already inside `expense`; payments are cash out but not a spend, so they are
                // a separate step (never added into expense/net) — keeps the rows adding up (ADR-023).
                ...(totals.card_payments > 0
                  ? [{ key: 'card_payments', label: t('cards.payment'), amount: totals.card_payments, color: colors.muted }]
                  : []),
              ]}
            />
            <View style={styles.totalsMeta}>
              <Text style={styles.count} testID="totals-count">{t('transactions.results', { count: totals.count })}</Text>
              {stale ? (
                <View style={styles.staleBadgeWrap}>
                  <StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.muted} />
                </View>
              ) : null}
            </View>
          </>
        ) : (
          // Fixed-geometry placeholder — never wraps the figure, replaces it, so an unconfirmed
          // context can never paint a plausible-looking 0.00 (ADR-019).
          <View testID="totals-skeleton">
            <Skeleton width={70} height={font.sm + 2} style={styles.totalSkeletonLabel} />
            <Skeleton width={110} height={font.lg + 6} />
          </View>
        )}
      </View>

      <QueryBoundary isLoading={!currentData && isFetching} error={currentData ? null : error} onRetry={refetch}>
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState text={hasFilters ? t('transactions.noResults') : t('transactions.empty')} />
              {hasFilters ? <AppButton title={t('transactions.resetFilters')} variant="ghost" onPress={resetFilters} /> : null}
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
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

const makeStyles = (colors) =>
  StyleSheet.create({
  headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing(2), paddingTop: spacing(1) },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginHorizontal: spacing(2), marginBottom: spacing(1) },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconButtonActive: { borderWidth: 2, borderColor: colors.cardAccent },
  activeFilters: { paddingHorizontal: spacing(2), paddingTop: spacing(0.5) },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  activeText: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.cardAccent },
  clearX: { padding: 14 }, // 16pt icon + 2x14 = 44pt target, fills the 44pt row
  descRow: { flexDirection: 'row', alignItems: 'center' },
  payIcon: { marginRight: spacing(0.75) },
  cashIcon: { width: 16, marginRight: spacing(0.75), fontSize: font.md, fontWeight: '800', color: colors.muted, textAlign: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingHorizontal: spacing(1.5),
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: spacing(1) },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing(2),
    marginTop: spacing(0.5),
    marginBottom: spacing(1),
    // The three-cell layout this replaced supplied its own inset via `totalCell`; without it the
    // figure sat flush against the card border.
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  totalLabel: { fontSize: font.sm, color: colors.muted, fontWeight: '600', marginBottom: spacing(0.25) },
  totalValue: { fontSize: font.lg, fontWeight: '800' },
  totalsMeta: { flexDirection: 'row', alignItems: 'center' },
  count: { fontSize: font.sm, color: colors.muted, fontWeight: '600' },
  empty: { paddingTop: spacing(4) },
  footer: { paddingVertical: spacing(2) },
  staleBadgeWrap: { marginLeft: spacing(1.5) },
  totalSkeletonLabel: { marginBottom: spacing(0.5) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desc: { fontSize: font.md, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(0.25) },
  meta: { fontSize: font.sm, color: colors.muted },
  loanBadge: {
    marginLeft: spacing(0.75),
    paddingHorizontal: spacing(0.75),
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  loanBadgeText: { fontSize: 10, fontWeight: '700', color: colors.muted },
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
