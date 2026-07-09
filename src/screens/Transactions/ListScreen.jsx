import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTransactionsQuery } from '../../services/api/transactions';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Card, MoneyText, Chip, QueryBoundary } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { formatDate, monthShortNames } from '../../utils/dates';

const TYPE_FILTERS = ['all', 'income', 'expense'];

// Years present in the data (desc), always including the current year — feeds the year dropdown.
const yearsFromData = (rows) => {
  const set = new Set([new Date().getFullYear()]);
  rows?.forEach((tx) => {
    const y = Number((tx.occurred_at ?? '').slice(0, 4));
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b - a);
};

export default function TransactionsList() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [typeFilter, setTypeFilter] = useState('all');
  const filters = { team_id: teamId, ...(typeFilter === 'all' ? {} : { type: typeFilter }) };
  const { data, isLoading, error, refetch } = useGetTransactionsQuery(filters);
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;

  // Client-side date filter (ADR-015): `year` null = all years; `month` (1-12) null = whole year.
  // occurred_at is a plain YYYY-MM-DD string, so a prefix match is exact and needs no parsing.
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(null);
  const [yearOpen, setYearOpen] = useState(false);

  const monthNames = useMemo(() => monthShortNames(i18n.language), [i18n.language]);
  const years = useMemo(() => yearsFromData(data), [data]);

  const visible = useMemo(() => {
    if (year == null) return data;
    const prefix = month == null ? String(year) : `${year}-${String(month).padStart(2, '0')}`;
    return data?.filter((tx) => (tx.occurred_at ?? '').startsWith(prefix));
  }, [data, year, month]);

  // Totals over the currently visible rows — reflects both the type and the date filter.
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    visible?.forEach((tx) => {
      if (tx.type === 'income') income += Number(tx.amount) || 0;
      else if (tx.type === 'expense') expense += Number(tx.amount) || 0;
    });
    return { income, expense };
  }, [visible]);

  const pickMonth = (m) => {
    if (year == null) setYear(new Date().getFullYear()); // a month needs a year to mean anything
    setMonth(month === m ? null : m);
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
      <ScreenHeader
        title={t('transactions.title')}
        style={styles.headerPad}
        right={
          <Pressable hitSlop={10} testID="lists-link" onPress={() => router.push('/(tabs)/transactions/lists')}>
            <Ionicons name="cart-outline" size={24} color={colors.primary} />
          </Pressable>
        }
      />

      <View style={styles.filters}>
        {TYPE_FILTERS.map((f) => (
          <Chip key={f} label={f === 'all' ? t('transactions.all') : t(`transactions.${f}`)} active={typeFilter === f} onPress={() => setTypeFilter(f)} />
        ))}
      </View>

      <View style={styles.dateRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
          <Chip label={t('transactions.all')} active={month == null} onPress={() => setMonth(null)} />
          {monthNames.map((name, i) => (
            <Chip key={name} label={name} active={month === i + 1} onPress={() => pickMonth(i + 1)} />
          ))}
        </ScrollView>
        <Pressable style={styles.yearBtn} testID="year-dropdown" onPress={() => setYearOpen(true)}>
          <Text style={styles.yearText}>{year == null ? t('transactions.allYears') : year}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.totals}>
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>{t('transactions.income')}</Text>
          <MoneyText amount={totals.income} currency={currency} style={[styles.totalValue, { color: colors.success }]} />
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>{t('transactions.expense')}</Text>
          <MoneyText amount={totals.expense} currency={currency} style={[styles.totalValue, { color: colors.danger }]} />
        </View>
      </View>

      <QueryBoundary
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!!visible && visible.length === 0}
        emptyText={t('transactions.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      <Modal visible={yearOpen} transparent animationType="fade" onRequestClose={() => setYearOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setYearOpen(false)}>
          <View style={styles.menu}>
            <Pressable style={styles.menuItem} onPress={() => { setYear(null); setYearOpen(false); }}>
              <Text style={[styles.menuText, year == null && styles.menuTextActive]}>{t('transactions.allYears')}</Text>
            </Pressable>
            {years.map((y) => (
              <Pressable key={y} style={styles.menuItem} onPress={() => { setYear(y); setYearOpen(false); }}>
                <Text style={[styles.menuText, year === y && styles.menuTextActive]}>{y}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

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
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing(2), paddingTop: spacing(1) },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing(2), paddingRight: spacing(1) },
  months: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing(1) },
  yearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing(1),
  },
  yearText: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing(2),
    marginTop: spacing(0.5),
    marginBottom: spacing(1),
    paddingVertical: spacing(1.25),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  totalCell: { flex: 1, alignItems: 'center' },
  totalDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  totalLabel: { fontSize: font.sm, color: colors.muted, fontWeight: '600', marginBottom: spacing(0.25) },
  totalValue: { fontSize: font.lg, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desc: { fontSize: font.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.25) },
  amount: { fontSize: font.md, fontWeight: '700', marginLeft: spacing(1) },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing(6) },
  menu: { backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  menuItem: { paddingVertical: spacing(1.5), paddingHorizontal: spacing(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuText: { fontSize: font.md, color: colors.text, textAlign: 'center' },
  menuTextActive: { color: colors.primary, fontWeight: '700' },
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
