import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddCardMutation, useGetCardQuery, useUpdateCardMutation } from '../../services/api/cards';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Screen, ScreenHeader, Field, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../components/theme';

const validDay = (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31;

// Doubles as edit: reached with ?id=<card id> from the detail screen.
export default function NewCard() {
  const { id } = useLocalSearchParams();
  const editing = id != null;
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const teamId = useActiveTeamId();
  const { canAdd, canEditRow } = usePermissions();
  const { data: card } = useGetCardQuery({ id, team_id: teamId }, { skip: !editing });
  const [addCard, { isLoading: adding }] = useAddCardMutation();
  const [updateCard, { isLoading: updating }] = useUpdateCardMutation();
  const [name, setName] = useState('');
  const [cutDay, setCutDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [limit, setLimit] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [touched, setTouched] = useState(false);
  useDismissOnContextChange();

  // Seed once: later refetches (any tx write invalidates Card) must not clobber an in-progress edit.
  const seeded = useRef(false);
  useEffect(() => {
    if (!card || seeded.current) return;
    seeded.current = true;
    setName(card.name ?? '');
    setCutDay(String(card.cut_day ?? ''));
    setDueDay(String(card.due_day ?? ''));
    setLimit(card.credit_limit != null ? String(card.credit_limit) : '');
  }, [card]);

  // Deep-link guard: FAB / edit affordances are already hidden for roles that can't use them (ADR-012).
  if (editing ? card && !canEditRow(card) : !canAdd) return <Redirect href="/(tabs)/settings/cards" />;

  const nameOk = name.trim() !== '';
  const cutOk = validDay(cutDay);
  const dueOk = validDay(dueDay);
  const limitOk = limit === '' || Number(limit) > 0;
  const valid = nameOk && cutOk && dueOk && limitOk;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    const body = { name: name.trim(), cut_day: Number(cutDay), due_day: Number(dueDay), credit_limit: limit === '' ? null : Number(limit) };
    try {
      if (editing) await updateCard({ id, ...body, team_id: teamId }).unwrap();
      else await addCard({ ...body, team_id: teamId }).unwrap();
      router.back();
    } catch (e) {
      setSubmitError(e?.message ?? t('common.error'));
    }
  };

  const err = (show, key) => (touched && show ? <Muted style={{ color: colors.danger, marginBottom: spacing(1.5) }}>{t(key)}</Muted> : null);

  return (
    <Screen>
      <ScreenHeader back title={editing ? t('cards.edit') : t('cards.new')} />
      <View>
        <Field label={t('cards.name')} value={name} onChangeText={setName} placeholder={t('cards.namePlaceholder')} />
        {err(!nameOk, 'cards.nameRequired')}
        <Field label={t('cards.cutDay')} value={cutDay} onChangeText={setCutDay} keyboardType="number-pad" placeholder="5" />
        {err(!cutOk, 'cards.dayInvalid')}
        <Field label={t('cards.dueDay')} value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" placeholder="25" />
        {err(!dueOk, 'cards.dayInvalid')}
        <Muted style={{ marginBottom: spacing(1.5) }}>{t('cards.dayHint')}</Muted>
        <Field label={t('cards.limit')} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="0.00" />
        {err(!limitOk, 'cards.limitInvalid')}
        {submitError ? <Muted style={{ color: colors.danger, marginBottom: spacing(1.5) }}>{submitError}</Muted> : null}
        <AppButton title={editing ? t('common.save') : t('common.create')} onPress={submit} loading={adding || updating} />
      </View>
    </Screen>
  );
}
