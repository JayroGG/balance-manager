import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { isStepUpRequired, useCreateTransferMutation } from '../../services/api/transfers';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { useOwnedContexts } from '../../hooks/useOwnedContexts';
import { useStepUp } from '../../hooks/useStepUp';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Field, AppButton, Chip, Muted, SectionTitle } from '../../components/ui';
import { formatMoney } from '../../utils/money';
import { todayISODate } from '../../utils/dates';
import { spacing } from '../../components/theme';
import { splitStatus, toVaultParts } from './split';

export default function NewTransfer() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const teamId = useActiveTeamId();
  const contexts = useOwnedContexts();
  const { getPermit, stepUpModal } = useStepUp();
  const { data: balance } = useGetBalanceQuery(teamId);
  const [createTransfer, { isLoading, error }] = useCreateTransferMutation();
  useDismissOnContextChange();

  const destinations = contexts.filter((c) => !c.isCurrent);
  const source = contexts.find((c) => c.isCurrent);
  const [destKey, setDestKey] = useState(null);
  const [amount, setAmount] = useState('');
  const [parts, setParts] = useState({});
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [reviewing, setReviewing] = useState(false);

  const dest = destinations.find((c) => c.team_id === destKey) ?? null;
  const num = Number(amount) || 0;
  const currency = balance?.currency;
  const money = (n) => formatMoney(n, currency, { showCurrency: 'symbol' });
  const vaults = (balance?.vaults ?? []).filter((v) => v.balance > 0);
  const status = splitStatus({ amount: num, available: balance?.available ?? 0, vaults, parts });
  const short = status.shortfall > 0;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const ready = dest && num > 0 && !status.blocked && dateOk && (!short || status.exact);

  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (submitting.current) return; // covers the biometric/step-up window, not just the request
    submitting.current = true;
    setBusy(true);
    try {
      await run();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const run = async () => {
    const permit = await getPermit();
    if (!permit) return; // user cancelled the step-up
    const body = { to_team_id: dest.team_id, amount: num };
    if (note.trim()) body.description = note.trim();
    if (date !== todayISODate()) body.occurred_at = date;
    if (short) body.vaults = toVaultParts(parts);
    try {
      await createTransfer({ team_id: teamId, permit, body }).unwrap();
      router.back();
      Alert.alert(t('transfers.success'));
    } catch {}
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('transfers.title')} />
      {destinations.length === 0 ? <Muted>{t('transfers.noDestination')}</Muted> : null}

      <SectionTitle>{t('transfers.destination')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(2) }}>
        {destinations.map((c) => (
          <Chip
            key={String(c.team_id)}
            label={c.label}
            active={destKey === c.team_id && dest != null}
            onPress={() => {
              setDestKey(c.team_id);
              setReviewing(false);
            }}
          />
        ))}
      </View>

      <Field
        label={t('transfers.amount')}
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setParts({});
          setReviewing(false);
        }}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      {balance ? <Muted>{t('transfers.available', { amount: money(balance.available) })}</Muted> : null}

      {num > 0 && status.blocked ? (
        <Muted style={{ color: colors.danger, marginVertical: spacing(1.5) }}>{t('transfers.blocked')}</Muted>
      ) : null}

      {num > 0 && short && !status.blocked ? (
        <View style={{ marginVertical: spacing(1.5) }}>
          <Muted style={{ color: colors.danger, marginBottom: spacing(1) }}>
            {t('transfers.short', { amount: money(status.shortfall) })}
          </Muted>
          {vaults.map((v) => (
            <Field
              key={v.id}
              label={t('transfers.vaultPart', { name: v.name, max: money(v.balance) })}
              value={parts[v.id] ?? ''}
              onChangeText={(val) => {
                setParts((p) => ({ ...p, [v.id]: val }));
                setReviewing(false);
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          ))}
          <Muted>{t('transfers.remaining', { amount: money(status.remaining) })}</Muted>
        </View>
      ) : null}

      <Field label={t('transfers.note')} value={note} onChangeText={setNote} placeholder="—" />
      <Field label={t('transfers.date')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

      {reviewing && ready ? (
        <View style={{ marginBottom: spacing(2) }}>
          <Muted>{t('transfers.summary', { amount: money(num), from: source?.label, to: dest.label })}</Muted>
          {short ? <Muted>{t('transfers.fromVaults', { amount: money(status.shortfall) })}</Muted> : null}
        </View>
      ) : null}
      {error ? <Muted style={{ color: colors.danger, marginBottom: spacing(1.5) }}>{isStepUpRequired(error) ? t('transfers.stepUpExpired') : error.message}</Muted> : null}

      {reviewing ? (
        <AppButton title={t('transfers.confirm')} onPress={submit} loading={isLoading || busy} disabled={!ready} />
      ) : (
        <AppButton title={t('transfers.review')} onPress={() => setReviewing(true)} disabled={!ready} />
      )}
      {stepUpModal}
    </Screen>
  );
}
