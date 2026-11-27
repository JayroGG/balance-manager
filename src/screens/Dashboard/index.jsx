import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useGetShoppingListsQuery } from '../../services/api/shoppingLists';
import { useGetTeamsQuery } from '../../services/api/teams';
import { setActiveTeam } from '../../reducers/context';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useActiveRole } from '../../hooks/useActiveRole';
import { useOwnedContexts } from '../../hooks/useOwnedContexts';
import { useUnreadActivity } from '../../hooks/useUnreadActivity';
import { useContextReady } from '../../hooks/useContextReady';
import { useOrderedVaults } from '../Vaults/reorder';
import { FlipCard3D } from '../../components/motion/FlipCard3D';
import { BalanceOptions } from './BalanceOptions';
import { GlassSurface } from '../../components/glass/GlassSurface';
import { GlassBackdrop } from '../../components/glass/GlassBackdrop';
import { GlassFill } from '../../components/glass/GlassFill';

const CARD_RADIUS = 16;
import { useTheme } from '../../hooks/useTheme';
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  MoneyText,
  SectionTitle,
  Muted,
  QueryBoundary,
  Skeleton,
  StaleBadge,
} from '../../components/ui';
import { formatDate, todayISODate } from '../../utils/dates';
import { formatMoney } from '../../utils/money';
import { DEFAULT_ACCENT, font, spacing } from '../../components/theme';

// First 3 non-empty vaults, server order (per-user order, plan FE item 4).
export const topVaults = (vaults) => (vaults ?? []).filter((v) => v.balance > 0).slice(0, 3);

const VaultRow = ({ vault, currency, onPress }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const pct =
    vault.target && vault.target > 0 ? Math.min(1, (vault.balance ?? 0) / vault.target) : null;
  return (
    <Card onPress={onPress}>
      <View style={styles.vaultHead}>
        <Text style={styles.vaultName}>{vault.name}</Text>
        <View style={styles.vaultHeadRight}>
          <MoneyText amount={vault.balance} currency={currency} showCurrency="symbol" style={styles.vaultBalance} />
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>
      </View>
      {pct !== null ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>
          <MoneyText amount={vault.target} currency={currency} showCurrency="symbol" style={styles.vaultTarget} />
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
  const balanceQuery = useGetBalanceQuery(teamId);
  const { data, isLoading, error, refetch } = balanceQuery;
  const { confirmed, stale, offline, lastUpdated } = useContextReady(balanceQuery);
  const { ordered: orderedVaults } = useOrderedVaults(data?.vaults);
  const topVaultRows = topVaults(orderedVaults);
  const { data: openLists } = useGetShoppingListsQuery({ status: 'open', team_id: teamId });
  const unread = useUnreadActivity();
  const ownedContexts = useOwnedContexts();
  const canTransfer = (role === null || role === 'owner') && ownedContexts.some((c) => !c.isCurrent);
  // Balance card flip menu (ADR-027): flips back after a pick, on context switch and on leaving the screen.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [teamId]);
  useFocusEffect(useCallback(() => () => setFlipped(false), []));
  const isOwnerHere = role === null || role === 'owner';
  const transferReason = !isOwnerHere ? t('dashboard.transferNotOwner') : t('dashboard.transferNoDestination');
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
  // Next payment: card with a statement due (> 0) and the earliest due_date; a past date is overdue (ADR-023).
  const cards = data?.cards ?? [];
  const nextDue = cards
    .filter((c) => c.statement_balance > 0 && c.due_date)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))[0];
  const todayISO = todayISODate();
  const nextOverdue = !!nextDue && nextDue.due_date < todayISO;
  const overdrawn = Number(data?.available) < 0;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <ScreenHeader
        title={t('dashboard.title')}
        right={
          <Pressable hitSlop={12} testID="activity-link" onPress={() => router.push('/(tabs)/dashboard/activity')}>
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
        {teams === undefined ? (
          <Skeleton width={100} height={32} radius={999} />
        ) : (
          <>
            <Chip
              label={t('context.personal')}
              active={teamId == null}
              dot={DEFAULT_ACCENT}
              onPress={() => dispatch(setActiveTeam(null))}
            />
            {teams.map((team) => (
              <Chip
                key={team.id}
                label={team.name}
                active={teamId === team.id}
                dot={team.color ?? undefined}
                onPress={() => dispatch(setActiveTeam(team.id))}
              />
            ))}
          </>
        )}
      </ScrollView>

      {role ? (
        <Muted style={styles.roleBadge}>
          {t(`teams.role_${role}`)}
          {role === 'guest' ? ` · ${t('teams.readOnly')}` : ''}
        </Muted>
      ) : null}

      {!confirmed ? (
        <>
          <Card style={styles.hero}>
            <Skeleton width={80} height={font.sm} style={styles.heroLabelSkeleton} />
            <Skeleton width={160} height={font.hero} style={styles.heroValueSkeleton} />
            <View style={styles.figureRow}>
              <Skeleton width={60} height={font.sm} style={styles.heroLabelSkeleton} />
              <Skeleton width={100} height={font.lg} style={styles.heroLabelSkeleton} />
            </View>
          </Card>

          <SectionTitle>{t('dashboard.vaults')}</SectionTitle>
          {[0, 1].map((i) => (
            <Card key={`vault-skeleton-${i}`}>
              <View style={styles.vaultHead}>
                <Skeleton width={120} height={font.md} />
                <Skeleton width={60} height={font.md} />
              </View>
            </Card>
          ))}
        </>
      ) : (
        <QueryBoundary isLoading={isLoading && !data} error={error} onRetry={refetch}>
          {/* All figures at once, no tap-to-cycle: the dashboard hero is glanced at, not operated.
              Available leads (it's the number you act on); total and lent sit under it. */}
          <GlassBackdrop accent={colors.primary} style={styles.heroScene}>
          <FlipCard3D
            testID="balance-flip"
            radius={CARD_RADIUS}
            underlay={<GlassFill />}
            flipped={flipped}
            onFlip={setFlipped}
            front={
            <GlassSurface
              flat
              testID="hero"
              style={[styles.heroGlass, overdrawn && styles.heroNegative]}
            >
              <View style={styles.hero}>
                <Text style={[styles.heroLabel, overdrawn && styles.heroLabelNegative]}>{t('dashboard.available')}</Text>
                <MoneyText amount={data?.available} currency={currency} style={[styles.heroFigure, overdrawn && styles.heroInkNegative]} signed />
                <View style={styles.figureRow}>
                  <Text style={[styles.heroLabel, overdrawn && styles.heroLabelNegative]}>{t('dashboard.total')}</Text>
                  <MoneyText amount={data?.total} currency={currency} style={[styles.heroSecondary, overdrawn && styles.heroInkNegative]} signed />
                </View>
                {data?.lent > 0 ? (
                  <View style={styles.figureRow}>
                    <Text style={[styles.heroLabel, overdrawn && styles.heroLabelNegative]}>{t('dashboard.lent')}</Text>
                    <MoneyText amount={data.lent} currency={currency} style={[styles.heroSecondary, overdrawn && styles.heroInkNegative]} />
                  </View>
                ) : null}
                {stale ? (
                  <StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.muted} />
                ) : null}
              </View>
            </GlassSurface>
            }
            back={
              <BalanceOptions
                radius={CARD_RADIUS}
                canTransfer={canTransfer}
                transferReason={transferReason}
                onTransfer={() => {
                  setFlipped(false);
                  router.push('/(tabs)/dashboard/transfer');
                }}
              />
            }
          />
          </GlassBackdrop>

          {cards.length ? (
            <Card onPress={() => router.navigate('/(tabs)/settings/cards')} testID="cards-block">
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vaultTarget}>{t('cards.totalOwed')}</Text>
                  <MoneyText amount={data.cards_owed} currency={currency} showCurrency="symbol" style={styles.vaultName} />
                  <Text
                    testID="cards-next-due"
                    style={[styles.vaultTarget, nextOverdue && { color: colors.danger, fontWeight: '700' }]}
                  >
                    {nextDue
                      ? nextOverdue
                        ? `${t('cards.overdue', { date: formatDate(nextDue.due_date) })} · ${t('cards.payBy', { amount: formatMoney(nextDue.statement_balance, currency, { showCurrency: 'symbol' }), date: formatDate(nextDue.due_date) })}`
                        : t('cards.payBy', { amount: formatMoney(nextDue.statement_balance, currency, { showCurrency: 'symbol' }), date: formatDate(nextDue.due_date) })
                      : t('cards.noneDue')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </View>
            </Card>
          ) : null}

          <SectionTitle>{t('dashboard.vaults')}</SectionTitle>
          {topVaultRows.length ? (
            topVaultRows.map((v) => (
              <VaultRow
                key={v.id}
                vault={v}
                currency={currency}
                onPress={() => router.navigate({ pathname: '/(tabs)/vaults/[id]', params: { id: v.id } })}
              />
            ))
          ) : (
            <Text style={styles.empty}>{t('dashboard.emptyVaults')}</Text>
          )}
          {data?.vaults?.length ? (
            <Pressable
              hitSlop={12}
              style={styles.seeAllBtn}
              onPress={() => router.navigate('/(tabs)/vaults')}
            >
              <Text style={styles.seeAll}>{t('dashboard.seeAllVaults')}</Text>
            </Pressable>
          ) : null}
        </QueryBoundary>
      )}

      <View style={styles.sectionHead}>
        <SectionTitle>{t('dashboard.shoppingLists')}</SectionTitle>
        <Pressable hitSlop={12} style={styles.seeAllBtn} onPress={() => router.navigate('/(tabs)/transactions/lists')}>
          <Text style={styles.seeAll}>{t('dashboard.seeAll')}</Text>
        </Pressable>
      </View>
      {openLists?.length ? (
        openLists.map((list) => (
          <Card
            key={list.id}
            onPress={() => router.navigate({ pathname: '/(tabs)/transactions/lists/[id]', params: { id: list.id } })}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>
        ))
      ) : (
        <Text style={styles.empty}>{t('dashboard.emptyLists')}</Text>
      )}
    </Screen>
  );
}

// Hero text derives from primaryText so it stays readable on ANY team accent (ADR-013).
const makeStyles = (colors) =>
  StyleSheet.create({
    switch: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing(1) },
    roleBadge: { marginBottom: spacing(1.5), textTransform: 'capitalize' },
    hero: { padding: spacing(3) },
    heroScene: { padding: spacing(2), marginBottom: spacing(1.5) },
    heroGlass: { borderRadius: CARD_RADIUS },
    // Overdrawn (available < 0, ADR-022): swap the accent surface for the card surface so the danger red is legible on any accent.
    heroNegative: { borderColor: colors.danger },
    heroLabelNegative: { color: colors.muted, opacity: 1 },
    heroInkNegative: { color: colors.text },
    heroLabel: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
    heroFigure: { color: colors.text, fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
    heroSecondary: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
    figureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
    heroLabelSkeleton: { opacity: 0.55 },
    heroValueSkeleton: { marginTop: spacing(0.5), opacity: 0.55 },
    vaultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    vaultHeadRight: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
    vaultName: { fontSize: font.md, fontWeight: '700', color: colors.text },
    vaultBalance: { fontSize: font.md, fontWeight: '700', color: colors.text },
    track: { height: 6, backgroundColor: colors.border, borderRadius: 999, marginTop: spacing(1.25), overflow: 'hidden' },
    fill: { height: 6, backgroundColor: colors.success, borderRadius: 999 },
    vaultTarget: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.75) },
    empty: { color: colors.muted, paddingVertical: spacing(2) },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seeAllBtn: { justifyContent: 'center', paddingVertical: spacing(1), paddingLeft: spacing(2), minHeight: 44 },
    seeAll: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    listName: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.text },
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
