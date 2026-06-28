import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { usePermissions } from '../../permissions';
import { Screen, Card, MoneyText, AppButton, Field, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';
import { formatDateTime } from '../../utils/dates';

export default function VaultDetail() {
  const { id } = useLocalSearchParams();
  const vaultId = Number(id);
  const router = useRouter();
  const { t } = useTranslation();
  const teamId = useActiveTeamId();
  const { canEditRow } = usePermissions();

  const { data: balance } = useGetBalanceQuery(teamId);
  const { data: vault, isLoading, error, refetch } = useGetVaultQuery({ id, team_id: teamId });
  const { data: history } = useGetVaultHistoryQuery({ id, team_id: teamId });
  const currency = balance?.currency;
  const figures = balance?.vaults?.find((v) => v.id === vaultId);
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
      <QueryBoundary isLoading={isLoading && !vault} error={error} onRetry={refetch}>
        <Card style={styles.hero}>
          <Text style={styles.name}>{figures?.name ?? vault?.name}</Text>
          <MoneyText amount={figures?.balance ?? 0} currency={currency} style={styles.balance} />
          <Text style={styles.target}>
            {figures?.target != null ? <>{t('vaults.target')}: <MoneyText amount={figures.target} currency={currency} /></> : t('vaults.noTarget')}
          </Text>
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
                <MoneyText amount={h.amount} currency={currency} style={styles.histAmount} />
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
            <AppButton
              title={t('common.save')}
              successTitle={t('common.saved')}
              onPress={onSave}
              loading={saving}
              disabled={!name.trim() || !dirty}
              success={!dirty && !!vault && !saving}
            />
            <AppButton title={t('common.delete')} variant="danger" onPress={onDelete} loading={deleting} disabled={!canDelete} style={{ marginTop: spacing(1.5) }} />
            {!canDelete ? <Muted style={{ marginTop: spacing(1) }}>{t('vaults.deleteNeedsZero')}</Muted> : null}
          </>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, padding: spacing(3), marginTop: spacing(2) },
  name: { color: '#DBEAFE', fontSize: font.md, fontWeight: '700' },
  balance: { color: '#FFFFFF', fontSize: font.hero, fontWeight: '800', marginTop: spacing(0.5) },
  target: { color: '#DBEAFE', fontSize: font.sm, marginTop: spacing(1) },
  actions: { flexDirection: 'row', marginVertical: spacing(1.5) },
  maxHint: { marginBottom: spacing(1.5) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontWeight: '700', fontSize: font.md },
  histAmount: { fontWeight: '700', color: colors.text },
  histDate: { color: colors.muted, fontSize: font.sm, marginTop: spacing(0.5) },
});
