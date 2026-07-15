import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddLoanMutation } from '../../services/api/loans';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Screen, ScreenHeader, Field, AppButton, MoneyText, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

export default function NewLoan() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [preExisting, setPreExisting] = useState(false);
  const [addLoan, { isLoading, error }] = useAddLoanMutation();
  const { data: balance } = useGetBalanceQuery(teamId);
  // Drop the half-filled form if the context switches — it would create in the wrong context.
  useDismissOnContextChange();

  // Guard the deep-link path: the FAB is already hidden when the user can't add (ADR-012).
  if (!canAdd) return <Redirect href="/(tabs)/loans" />;

  const available = balance?.available ?? 0;
  const amountNum = Number(amount);
  const hasAmount = amount !== '' && amountNum > 0;
  // pre_existing records the money as an opening income (it never touches `available`) — only bound
  // the amount against `available` when it would actually lock spendable money out (ADR-009 UX).
  const overAvailable = !preExisting && hasAmount && amountNum > available;

  const submit = async () => {
    if (!name.trim() || overAvailable) return;
    const body = { name: name.trim() };
    if (hasAmount) body.amount = amountNum;
    if (preExisting) body.pre_existing = true;
    try {
      await addLoan({ ...body, team_id: teamId }).unwrap();
      router.back();
    } catch {}
  };

  return (
    <Screen>
      <ScreenHeader back title={t('loans.new')} />
      <View>
        <Field label={t('loans.name')} value={name} onChangeText={setName} placeholder="—" />
        <Field
          label={t('loans.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('loans.alreadyLent')}</Text>
          <Switch
            value={preExisting}
            onValueChange={setPreExisting}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.card}
          />
        </View>
        <Muted style={styles.hint}>{t('loans.alreadyLentHint')}</Muted>
        {!preExisting && hasAmount ? (
          <Muted style={styles.maxHint}>
            {t('dashboard.available')}: <MoneyText amount={available} currency={balance?.currency} />
          </Muted>
        ) : null}
        {error ? <Muted style={{ color: colors.danger, marginBottom: spacing(1.5) }}>{error.message}</Muted> : null}
        <AppButton
          title={t('common.create')}
          onPress={submit}
          loading={isLoading}
          disabled={!name.trim() || overAvailable}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing(0.75),
    },
    switchLabel: { fontSize: font.md, color: colors.text, flex: 1, marginRight: spacing(1) },
    hint: { marginBottom: spacing(2) },
    maxHint: { marginBottom: spacing(1.5) },
  });
