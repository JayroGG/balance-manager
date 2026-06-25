import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useGetTransactionsQuery } from '../../services/api/transactions';
import { Screen, Card, MoneyText, AppButton, Field, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';
import { formatDate, formatDateTime } from '../../utils/dates';

export default function VaultDetail() {
  const { id } = useLocalSearchParams();
  const vaultId = Number(id);
  const router = useRouter();
  const { t } = useTranslation();

  const { data: balance } = useGetBalanceQuery();
  const { data: vault, isLoading, error, refetch } = useGetVaultQuery(id);
  const { data: history } = useGetVaultHistoryQuery(id);
  const currency = balance?.currency;
  const figures = balance?.vaults?.find((v) => v.id === vaultId);

  const [picker, setPicker] = useState(null); // null | 'allocate' | 'withdraw'
  const { data: incomeTxns } = useGetTransactionsQuery({ type: 'income' }, { skip: picker !== 'allocate' });
  const { data: vaultTxns } = useGetTransactionsQuery({ vault_id: vaultId }, { skip: picker !== 'withdraw' });

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

  const candidates = useMemo(() => {
    if (picker === 'allocate') return (incomeTxns ?? []).filter((tx) => tx.vault_id !== vaultId);
    if (picker === 'withdraw') return vaultTxns ?? [];
    return [];
  }, [picker, incomeTxns, vaultTxns, vaultId]);

  const onPick = async (txn) => {
    try {
      if (picker === 'allocate') await allocate({ id: vaultId, transaction_id: txn.id }).unwrap();
      else await withdraw({ id: vaultId, transaction_id: txn.id }).unwrap();
      setPicker(null);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onSave = async () => {
    const body = { name: name.trim() };
    body.target_amount = target !== '' && Number(target) > 0 ? Number(target) : null;
    try {
      await updateVault({ id: vaultId, ...body }).unwrap();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onDelete = () => {
    Alert.alert(t('vaults.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVault(vaultId).unwrap();
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

        <View style={styles.actions}>
          <AppButton title={t('vaults.allocate')} onPress={() => setPicker(picker === 'allocate' ? null : 'allocate')} style={{ flex: 1, marginRight: spacing(1) }} />
          <AppButton title={t('vaults.withdraw')} variant="ghost" onPress={() => setPicker(picker === 'withdraw' ? null : 'withdraw')} style={{ flex: 1 }} />
        </View>

        {picker ? (
          <Card>
            <Muted>{picker === 'allocate' ? t('vaults.allocateHint') : t('vaults.withdrawHint')}</Muted>
            {candidates.length === 0 ? (
              <Muted style={{ paddingVertical: spacing(1.5) }}>{t('vaults.noEligible')}</Muted>
            ) : (
              candidates.map((tx) => (
                <Pressable key={tx.id} onPress={() => onPick(tx)} disabled={allocating || withdrawing} style={styles.pickRow}>
                  <Text style={styles.pickDesc} numberOfLines={1}>{tx.description || formatDate(tx.occurred_at)}</Text>
                  <MoneyText amount={tx.amount} currency={currency} style={styles.pickAmount} />
                </Pressable>
              ))
            )}
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
          <Muted>{t('vaults.noEligible')}</Muted>
        )}

        <SectionTitle>{t('common.edit')}</SectionTitle>
        <Field label={t('vaults.name')} value={name} onChangeText={setName} />
        <Field label={t('vaults.targetAmount')} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" />
        <AppButton title={t('common.save')} onPress={onSave} loading={saving} disabled={!name.trim()} />
        <AppButton title={t('common.delete')} variant="danger" onPress={onDelete} loading={deleting} style={{ marginTop: spacing(1.5) }} />
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
  pickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(1.25), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pickDesc: { flex: 1, color: colors.text, fontSize: font.md },
  pickAmount: { color: colors.success, fontWeight: '700', marginLeft: spacing(1) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontWeight: '700', fontSize: font.md },
  histAmount: { fontWeight: '700', color: colors.text },
  histDate: { color: colors.muted, fontSize: font.sm, marginTop: spacing(0.5) },
});
