import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddTransferMutation } from '../../services/api/transfers';
import { useGetTeamsQuery } from '../../services/api/teams';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { Screen, ScreenHeader, Card, Field, Chip, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Cross-context transfer (ADR-014): one atomic operation — expense in `from`, income in `to`.
// Both pickers offer personal + only write-capable teams (owner/member); the backend enforces the
// same matrix on both ends and the from-context's available-never-negative rule.
export default function NewTransfer() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const activeTeamId = useActiveTeamId();
  const { data: teams } = useGetTeamsQuery();
  const writableTeams = (teams ?? []).filter((tm) => tm.role === 'owner' || tm.role === 'member');
  // Seed `from` with the active context when it's writable — the transfer usually leaves
  // the context you're looking at.
  const activeWritable = activeTeamId == null || writableTeams.some((tm) => tm.id === activeTeamId);

  const [fromTeamId, setFromTeamId] = useState(activeWritable ? activeTeamId : null);
  const [toTeamId, setToTeamId] = useState(undefined); // undefined = not picked yet
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [addTransfer, { isLoading, error }] = useAddTransferMutation();

  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0;
  const samePicked = toTeamId !== undefined && fromTeamId === toTeamId;
  const canSubmit = amountValid && toTeamId !== undefined && !samePicked;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const body = { amount: amountNum };
    if (fromTeamId != null) body.from_team_id = fromTeamId;
    if (toTeamId != null) body.to_team_id = toTeamId;
    if (description.trim()) body.description = description.trim();
    try {
      await addTransfer(body).unwrap();
      router.back();
    } catch {
      // surfaced inline via `error`
    }
  };

  const ContextPicker = ({ label, value, onChange }) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Chip label={t('context.personal')} active={value === null} onPress={() => onChange(null)} />
        {writableTeams.map((tm) => (
          <Chip key={tm.id} label={tm.name} active={value === tm.id} onPress={() => onChange(tm.id)} />
        ))}
      </View>
    </>
  );

  return (
    <Screen scroll>
      <ScreenHeader back title={t('transfers.title')} />

      <Card>
        <ContextPicker label={t('transfers.from')} value={fromTeamId} onChange={setFromTeamId} />
        <ContextPicker label={t('transfers.to')} value={toTeamId} onChange={setToTeamId} />
        {samePicked ? <Muted style={styles.err}>{t('transfers.sameContext')}</Muted> : null}

        <Field
          label={t('transactions.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field label={t('transactions.description')} value={description} onChangeText={setDescription} placeholder="—" />

        {error ? <Muted style={styles.err}>{error.message}</Muted> : null}
        <AppButton title={t('transfers.submit')} onPress={onSubmit} loading={isLoading} disabled={!canSubmit} />
      </Card>

      <Muted style={styles.hint}>{t('transfers.hint')}</Muted>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
    err: { color: colors.danger, marginBottom: spacing(1.5) },
    hint: { marginTop: spacing(1) },
  });
