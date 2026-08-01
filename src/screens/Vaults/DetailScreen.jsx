import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetVaultQuery,
  useGetVaultHistoryQuery,
  useUpdateVaultMutation,
  useDeleteVaultMutation,
  useAllocateVaultMutation,
  useWithdrawVaultMutation,
} from '../../services/api/vaults';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { useContextReady } from '../../hooks/useContextReady';
import { Screen, ScreenHeader, Card, MoneyText, AppButton, Field, SectionTitle, Muted, QueryBoundary, Skeleton, StaleBadge } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDateTime } from '../../utils/dates';

export default function VaultDetail() {
  const { id } = useLocalSearchParams();
  const vaultId = Number(id);
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  // This vault id is scoped to the context it was opened in — leave the screen if the context switches.
  useDismissOnContextChange();
  const { canEditRow } = usePermissions();

  const balanceQuery = useGetBalanceQuery(teamId);
  const { data: balance } = balanceQuery;
  const { data: vault, isLoading, error, refetch } = useGetVaultQuery({ id, team_id: teamId });
  const { data: history } = useGetVaultHistoryQuery({ id, team_id: teamId });
  const currency = balance?.currency;
  const figures = balance?.vaults?.find((v) => v.id === vaultId);
  // The hero balance is a fixed-geometry figure — never paints under an unconfirmed context
  // (ADR-019). Staleness/lastUpdated describe this screen's own money data (the balance query).
  const { confirmed, stale, offline, lastUpdated } = useContextReady(balanceQuery);
  // RBAC: owner edits any vault, member only their own, guest none — gate allocate/withdraw/save/delete
  // (the API 403s a violation too). History + balances stay visible to all roles (ADR-012).
  const canEdit = canEditRow(vault);

  // Allocate/withdraw move an amount between spendable and the vault (ADR-009).
  const [picker, setPicker] = useState(null); // null | 'allocate' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [flashed, setFlashed] = useState(null); // 'allocate' | 'withdraw' — transient ✓ on the action button
  const flashRef = useRef();
  useEffect(() => () => clearTimeout(flashRef.current), []);
  const triggerFlash = (action) => {
    setFlashed(action);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashed(null), 1500);
  };

  const [allocate, { isLoading: allocating }] = useAllocateVaultMutation();
  const [withdraw, { isLoading: withdrawing }] = useWithdrawVaultMutation();
  const [updateVault, { isLoading: saving }] = useUpdateVaultMutation();
  const [deleteVault, { isLoading: deleting }] = useDeleteVaultMutation();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  // Seed edit fields once the vault loads.
  useEffect(() => {
    if (vault) {
      setName(vault.name ?? '');
      setTarget(vault.target_amount != null ? String(vault.target_amount) : '');
    }
  }, [vault]);

  // Save locks (✓ Saved) until name/target differ from the saved vault.
  const targetNorm = target !== '' && Number(target) > 0 ? Number(target) : null;
  const dirty = !vault || name.trim() !== (vault.name ?? '') || targetNorm !== (vault.target_amount ?? null);

  // Amount bounds mirror the backend: allocate ≤ available, withdraw ≤ vault balance (it 400s otherwise).
  const available = balance?.available ?? 0;
  const vaultBalance = figures?.balance ?? 0;
  const max = picker === 'allocate' ? available : vaultBalance;
  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0 && amountNum <= max;

  const openPicker = (next) => {
    setAmount('');
    setPicker(picker === next ? null : next);
  };

  const onConfirm = async () => {
    const action = picker;
    try {
      if (action === 'allocate') await allocate({ id: vaultId, amount: amountNum, team_id: teamId }).unwrap();
      else await withdraw({ id: vaultId, amount: amountNum, team_id: teamId }).unwrap();
      setPicker(null);
      setAmount('');
      triggerFlash(action);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onSave = async () => {
    const body = { name: name.trim() };
    body.target_amount = target !== '' && Number(target) > 0 ? Number(target) : null;
    try {
      await updateVault({ id: vaultId, ...body, team_id: teamId }).unwrap();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  // A vault can only be deleted at a zero balance (backend 400s otherwise).
  const canDelete = vaultBalance <= 0;
  const onDelete = () => {
    Alert.alert(t('vaults.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVault({ id: vaultId, team_id: teamId }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('vaults.title')} />
      <QueryBoundary isLoading={isLoading && !vault} error={error} onRetry={refetch}>
        <Card style={styles.hero}>
          {confirmed ? (
            <>
              <Text style={styles.name}>{figures?.name ?? vault?.name}</Text>
              <MoneyText amount={figures?.balance ?? 0} currency={currency} style={styles.balance} />
              <Text style={styles.target}>
                {figures?.target != null ? <>{t('vaults.target')}: <MoneyText amount={figures.target} currency={currency} /></> : t('vaults.noTarget')}
              </Text>
              {stale ? (
                <View style={styles.staleBadgeWrap}>
                  <StaleBadge lastUpdated={lastUpdated} offline={offline} color={colors.primaryText} />
                </View>
              ) : null}
            </>
          ) : (
            // Replaces the figure, never wraps it — a skeleton on the accent card must not render
            // a 0.00 placeholder (ADR-019). Tinted with primaryText so it stays visible on any accent.
            <>
              <Skeleton width={110} height={font.md} style={styles.heroSkeletonTint} />
              <Skeleton width={160} height={font.hero} style={[styles.heroSkeletonTint, styles.heroSkeletonBalance]} />
              <Skeleton width={120} height={font.sm} style={[styles.heroSkeletonTint, styles.heroSkeletonTarget]} />
            </>
          )}
        </Card>

        {canEdit ? (
          <View style={styles.actions}>
            <AppButton
              title={t('vaults.allocate')}
              successTitle={t('vaults.allocated')}
              success={flashed === 'allocate'}
              onPress={() => openPicker('allocate')}
              style={{ flex: 1, marginRight: spacing(1) }}
            />
            <AppButton
              title={t('vaults.withdraw')}
              successTitle={t('vaults.withdrawn')}
              success={flashed === 'withdraw'}
              variant="ghost"
              onPress={() => openPicker('withdraw')}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {canEdit && picker ? (
          <Card>
            <Muted>{picker === 'allocate' ? t('vaults.allocateHint') : t('vaults.withdrawHint')}</Muted>
            <Field
              label={t('transactions.amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Muted style={styles.maxHint}>
              {picker === 'allocate' ? t('dashboard.available') : t('vaults.balance')}:{' '}
              <MoneyText amount={max} currency={currency} />
            </Muted>
            <AppButton
              title={t('common.confirm')}
              onPress={onConfirm}
              loading={allocating || withdrawing}
              disabled={!amountValid}
            />
          </Card>
        ) : null}

        <SectionTitle>{t('vaults.history')}</SectionTitle>
        {history?.length ? (
          history.map((h) => (
            <Card key={h.id}>
              <View style={styles.rowBetween}>
                <Text style={[styles.action, { color: h.action === 'allocate' ? colors.success : colors.danger }]}>
                  {t(`vaults.${h.action}`)}
                </Text>
                <MoneyText amount={h.amount} currency={currency} style={styles.histAmount} showCurrency={false} />
              </View>
              <Text style={styles.histDate}>{formatDateTime(h.created_at)}</Text>
            </Card>
          ))
        ) : (
          <Muted>{t('vaults.noHistory')}</Muted>
        )}

        {canEdit ? (
          <>
            <SectionTitle>{t('common.edit')}</SectionTitle>
            <Field label={t('vaults.name')} value={name} onChangeText={setName} />
            <Field label={t('vaults.targetAmount')} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" />
            {/* Save only when there are valid unsaved changes; it hides again once saved. */}
            {dirty && name.trim() ? (
              <AppButton title={t('common.save')} onPress={onSave} loading={saving} />
            ) : null}
            {/* A vault deletes only at a zero balance — show a small trash icon, else the reason. */}
            {canDelete ? (
              <Pressable onPress={onDelete} disabled={deleting} hitSlop={12} style={styles.deleteIcon}>
                {deleting ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={22} color={colors.danger} />}
              </Pressable>
            ) : (
              <Muted style={styles.deleteHint}>{t('vaults.deleteNeedsZero')}</Muted>
            )}
          </>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

// Hero text derives from primaryText so it stays readable on ANY team accent (ADR-013).
const makeStyles = (colors) =>
  StyleSheet.create({
  hero: { backgroundColor: colors.primary, padding: spacing(3) },
  name: { color: colors.primaryText, opacity: 0.85, fontSize: font.md, fontWeight: '700' },
  balance: { color: colors.primaryText, fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
  target: { color: colors.primaryText, opacity: 0.85, fontSize: font.sm, marginTop: spacing(1) },
  // primaryText is always a 6-digit hex (contrastOn), so a hex-alpha suffix stays readable on ANY accent.
  heroSkeletonTint: { backgroundColor: `${colors.primaryText}40` },
  heroSkeletonBalance: { marginTop: spacing(0.5) },
  heroSkeletonTarget: { marginTop: spacing(1) },
  staleBadgeWrap: { marginTop: spacing(1) },
  actions: { flexDirection: 'row', marginVertical: spacing(1.5) },
  maxHint: { marginBottom: spacing(1.5) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontWeight: '700', fontSize: font.md },
  histAmount: { fontWeight: '700', color: colors.text },
  histDate: { color: colors.muted, fontSize: font.sm, marginTop: spacing(0.5) },
  deleteIcon: { alignSelf: 'center', padding: spacing(2), marginTop: spacing(1) },
  deleteHint: { textAlign: 'center', marginTop: spacing(1.5) },
});
