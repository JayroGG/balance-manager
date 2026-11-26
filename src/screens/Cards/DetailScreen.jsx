import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetCardQuery, useDeleteCardMutation, usePayCardMutation } from '../../services/api/cards';
import { useGetTransactionsInfiniteQuery } from '../../services/api/transactions';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { useContextReady } from '../../hooks/useContextReady';
import { Screen, ScreenHeader, Card, MoneyText, AppButton, Field, SectionTitle, Muted, QueryBoundary, Skeleton, StaleBadge } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDate, todayISODate } from '../../utils/dates';
import { formatMoney } from '../../utils/money';
import { isOverdue } from './ListScreen';

export default function CardDetail() {
  const { id } = useLocalSearchParams();
  const cardId = Number(id);
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  useDismissOnContextChange();
  const { canEditRow } = usePermissions();

  const cardQuery = useGetCardQuery({ id, team_id: teamId });
  const { data: card, isLoading, error, refetch } = cardQuery;
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;
  const { confirmed, stale, offline, lastUpdated } = useContextReady(cardQuery);
  const canEdit = canEditRow(card);

  const txQuery = useGetTransactionsInfiniteQuery({ card_id: cardId, team_id: teamId }, { skip: !confirmed });
  const { currentData, hasNextPage, fetchNextPage, isFetchingNextPage } = txQuery;
  const items = useMemo(() => (confirmed ? currentData?.pages.flatMap((p) => p.items) ?? [] : []), [currentData, confirmed]);

  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [flashed, setFlashed] = useState(false);
  const flashRef = useRef();
  useEffect(() => () => clearTimeout(flashRef.current), []);
  const [payCard, { isLoading: payPending }] = usePayCardMutation();
  const [deleteCard, { isLoading: deleting }] = useDeleteCardMutation();

  const owed = card?.owed ?? 0;
  const overdue = !!card && isOverdue(card);
  const amountNum = Number(amount);
  const overOwed = amount !== '' && amountNum > owed;
  const amountValid = amount !== '' && amountNum > 0 && amountNum <= owed;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  const openPay = () => {
    if (!paying) {
      setAmount(card?.statement_balance > 0 ? String(card.statement_balance) : '');
      setDate(todayISODate());
    }
    setPaying(!paying);
  };

  const onConfirmPay = async () => {
    try {
      await payCard({ id: cardId, amount: amountNum, occurred_at: date, team_id: teamId }).unwrap();
      setPaying(false);
      setAmount('');
      setFlashed(true);
      clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setFlashed(false), 1500);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const canDelete = owed <= 0;
  const onDelete = () => {
    Alert.alert(t('cards.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCard({ id: cardId, team_id: teamId }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  const heroText = (style) => [styles.heroSub, style];

  return (
    <Screen scroll>
      <ScreenHeader
        back
        title={card?.name ?? t('cards.title')}
        right={
          canEdit ? (
            <Pressable
              hitSlop={12}
              style={styles.tap}
              accessibilityLabel={t('cards.edit')}
              onPress={() => router.push({ pathname: '/(tabs)/settings/cards/new', params: { id: cardId } })}
            >
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </Pressable>
          ) : null
        }
      />
      <QueryBoundary isLoading={isLoading && !card} error={error} onRetry={refetch}>
        <Card style={styles.hero}>
          {confirmed && card ? (
            <>
              <Text style={styles.heroLabel}>{t('cards.owed')}</Text>
              <MoneyText amount={card.owed} currency={currency} style={styles.heroAmount} />
              {card.statement_balance > 0 ? (
                <Text style={heroText(overdue && styles.heroOverdue)}>
                  {t('cards.payBy', {
                    amount: formatMoney(card.statement_balance, currency),
                    date: formatDate(card.due_date),
                  })}
                </Text>
              ) : (
                <Text style={heroText()}>{t('cards.nothingDue')}</Text>
              )}
              {overdue ? <Text style={[heroText(), styles.heroOverdue]}>{t('cards.overdue', { date: formatDate(card.due_date) })}</Text> : null}
              {stale ? (
                <View style={styles.staleBadgeWrap}>
                  <StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.primaryText} />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Skeleton width={110} height={font.md} style={styles.heroSkeletonTint} />
              <Skeleton width={160} height={font.hero} style={[styles.heroSkeletonTint, styles.heroSkeletonGap]} />
              <Skeleton width={140} height={font.sm} style={[styles.heroSkeletonTint, styles.heroSkeletonGap]} />
            </>
          )}
        </Card>

        {confirmed && card ? (
          <Card>
            <Figure label={t('cards.statement')} styles={styles}>
              <MoneyText amount={card.statement_balance} currency={currency} style={styles.figValue} showCurrency="symbol" />
            </Figure>
            <Figure label={t('cards.dueDate')} styles={styles}>
              <Text style={[styles.figValue, overdue && { color: colors.danger }]}>{formatDate(card.due_date)}</Text>
            </Figure>
            <Figure label={t('cards.currentPeriod')} styles={styles}>
              <MoneyText amount={card.current_period} currency={currency} style={styles.figValue} showCurrency="symbol" />
            </Figure>
            <Figure label={t('cards.lastCut')} styles={styles}>
              <Text style={styles.figValue}>{formatDate(card.last_cut)}</Text>
            </Figure>
            {card.credit_limit != null ? (
              <Text style={styles.limit}>
                {t('cards.limitUsed', {
                  used: formatMoney(card.owed, currency, { showCurrency: 'symbol' }),
                  limit: formatMoney(card.credit_limit, currency, { showCurrency: 'symbol' }),
                })}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {canEdit && confirmed && card && owed > 0 ? (
          <AppButton
            title={t('cards.pay')}
            successTitle={t('cards.payDone')}
            success={flashed}
            onPress={openPay}
            style={{ marginVertical: spacing(1.5) }}
          />
        ) : null}

        {canEdit && paying ? (
          <Card>
            <Muted>{t('cards.payHint')}</Muted>
            <Field label={t('cards.payAmount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            {overOwed ? <Muted style={styles.overHint}>{t('cards.payExceeds')}</Muted> : null}
            <Field label={t('cards.payDate')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            <AppButton title={t('common.confirm')} onPress={onConfirmPay} loading={payPending} disabled={!amountValid || !dateValid} />
          </Card>
        ) : null}

        <SectionTitle>{t('cards.history')}</SectionTitle>
        {items.length ? (
          items.map((tx) => {
            const payment = tx.type === 'card_payment';
            return (
              <Card key={tx.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.desc} numberOfLines={1}>
                      {payment ? t('cards.payment') : tx.description || t(`transactions.${tx.type}`)}
                    </Text>
                    <Text style={styles.meta}>{formatDate(tx.occurred_at)}</Text>
                  </View>
                  <MoneyText
                    amount={tx.amount}
                    currency={currency}
                    showCurrency="symbol"
                    style={[styles.amount, { color: payment ? colors.muted : colors.danger }]}
                  />
                </View>
              </Card>
            );
          })
        ) : (
          <Muted>{t('cards.noHistory')}</Muted>
        )}
        {hasNextPage ? (
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppButton title={t('cards.seeAll')} variant="ghost" onPress={fetchNextPage} />
          )
        ) : null}

        {canEdit && card ? (
          canDelete ? (
            <Pressable onPress={onDelete} disabled={deleting} hitSlop={12} style={styles.deleteIcon} accessibilityLabel={t('common.delete')}>
              {deleting ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={22} color={colors.danger} />}
            </Pressable>
          ) : (
            <Muted style={styles.deleteHint}>{t('cards.deleteNeedsZero')}</Muted>
          )
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const Figure = ({ label, children, styles }) => (
  <View style={styles.figRow}>
    <Text style={styles.figLabel}>{label}</Text>
    {children}
  </View>
);

const makeStyles = (colors) =>
  StyleSheet.create({
    tap: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    hero: { backgroundColor: colors.primary, padding: spacing(3) },
    heroLabel: { color: colors.primaryText, opacity: 0.85, fontSize: font.md, fontWeight: '700' },
    heroAmount: { color: colors.primaryText, fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
    heroSub: { color: colors.primaryText, opacity: 0.85, fontSize: font.sm, marginTop: spacing(1) },
    heroOverdue: { fontWeight: '800', opacity: 1 },
    heroSkeletonTint: { backgroundColor: `${colors.primaryText}40` },
    heroSkeletonGap: { marginTop: spacing(1) },
    staleBadgeWrap: { marginTop: spacing(1) },
    figRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(0.75) },
    figLabel: { color: colors.muted, fontSize: font.sm },
    figValue: { color: colors.text, fontSize: font.md, fontWeight: '700' },
    limit: { color: colors.muted, fontSize: font.sm, marginTop: spacing(1) },
    overHint: { color: colors.danger, marginBottom: spacing(1) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    desc: { fontWeight: '700', fontSize: font.md, color: colors.text },
    meta: { color: colors.muted, fontSize: font.sm, marginTop: spacing(0.5) },
    amount: { fontWeight: '700', fontSize: font.md },
    deleteIcon: { alignSelf: 'center', padding: spacing(2), marginTop: spacing(1), minWidth: 44, minHeight: 44 },
    deleteHint: { textAlign: 'center', marginTop: spacing(1.5) },
  });
