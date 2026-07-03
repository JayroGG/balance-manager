import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetSourcesQuery,
  useAddSourceMutation,
  useUpdateSourceMutation,
  useDeleteSourceMutation,
  useGetAliasesQuery,
  useAddAliasMutation,
  useDeleteAliasMutation,
} from '../../services/api/sources';
import { useGetTeamsQuery } from '../../services/api/teams';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { Screen, ScreenHeader, Card, Field, Chip, AppButton, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

const TYPES = ['account', 'credit_card'];
const MATCH_KINDS = ['card_last4', 'channel_default'];

// Create/edit a payment source (ADR-014). The routing picker offers personal + only the teams the
// user can WRITE to (owner/member — the backend 400s a guest target). The default category follows
// the routed context, since that's where auto-posted transactions land. Aliases (how notifications
// identify this source) are managed inline once the source exists.
export default function EditSource() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const { data: sources } = useGetSourcesQuery();
  const source = id != null ? sources?.find((s) => String(s.id) === String(id)) : null;
  const isEdit = !!source;

  const { data: teams } = useGetTeamsQuery();
  const writableTeams = (teams ?? []).filter((tm) => tm.role === 'owner' || tm.role === 'member');

  const [name, setName] = useState(source?.name ?? '');
  const [type, setType] = useState(source?.type ?? 'account');
  const [bank, setBank] = useState(source?.bank ?? '');
  const [targetTeamId, setTargetTeamId] = useState(source?.target_team_id ?? null);
  const [categoryId, setCategoryId] = useState(source?.default_category_id ?? null);

  // Categories live per context — pick from the routed one.
  const { data: categories } = useGetCategoriesQuery(targetTeamId);

  const [addSource, { isLoading: creating }] = useAddSourceMutation();
  const [updateSource, { isLoading: saving }] = useUpdateSourceMutation();
  const [deleteSource, { isLoading: deleting }] = useDeleteSourceMutation();

  const onSave = async () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      type,
      bank: bank.trim() || null,
      target_team_id: targetTeamId,
      default_category_id: categoryId,
    };
    try {
      if (isEdit) {
        await updateSource({ id: source.id, ...body }).unwrap();
        router.back();
      } else {
        const created = await addSource(body).unwrap();
        // Straight into edit mode so aliases can be added right away.
        router.replace({ pathname: '/(tabs)/settings/source', params: { id: created.id } });
      }
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onDelete = () => {
    Alert.alert(t('sources.deleteConfirm'), source?.name ?? '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSource({ id: source.id }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  const routeTargetSafe = (teamId) => {
    setTargetTeamId(teamId);
    setCategoryId(null); // categories belong to the routed context
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={isEdit ? t('sources.edit') : t('sources.new')} />

      <Card>
        <Field label={t('sources.name')} value={name} onChangeText={setName} placeholder="Nu account" autoFocus={!isEdit} />

        <Text style={styles.label}>{t('sources.type')}</Text>
        <View style={styles.row}>
          {TYPES.map((tp) => (
            <Chip key={tp} label={t(`sources.type_${tp}`)} active={type === tp} onPress={() => setType(tp)} />
          ))}
        </View>

        <Field label={t('sources.bank')} value={bank} onChangeText={setBank} placeholder="nu" autoCapitalize="none" />

        <Text style={styles.label}>{t('sources.routesTo')}</Text>
        <View style={styles.row}>
          <Chip label={t('context.personal')} active={targetTeamId == null} onPress={() => routeTargetSafe(null)} />
          {writableTeams.map((tm) => (
            <Chip key={tm.id} label={tm.name} active={targetTeamId === tm.id} onPress={() => routeTargetSafe(tm.id)} />
          ))}
        </View>

        <Text style={styles.label}>{t('sources.defaultCategory')}</Text>
        <View style={styles.row}>
          {(categories ?? []).length === 0 ? <Muted>{t('common.none')}</Muted> : null}
          {(categories ?? []).map((c) => (
            <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
        </View>

        <AppButton title={t('common.save')} onPress={onSave} loading={creating || saving} disabled={!name.trim()} />
      </Card>

      {isEdit ? (
        <AliasesSection sourceId={source.id} />
      ) : (
        <Muted style={styles.hint}>{t('sources.saveFirst')}</Muted>
      )}

      {isEdit ? (
        <AppButton title={t('sources.deleteSource')} variant="danger" onPress={onDelete} loading={deleting} style={{ marginTop: spacing(2) }} />
      ) : null}
    </Screen>
  );
}

// The recognition rules for one source: channel + (card last-4 | channel default). Kept as a
// sibling component so the alias queries only run once the source exists.
function AliasesSection({ sourceId }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const { data: aliases, isLoading, error, refetch } = useGetAliasesQuery({ source_id: sourceId });
  const [addAlias, { isLoading: adding }] = useAddAliasMutation();
  const [deleteAlias] = useDeleteAliasMutation();

  const [channel, setChannel] = useState('');
  const [matchKind, setMatchKind] = useState('card_last4');
  const [last4, setLast4] = useState('');
  const [last4Invalid, setLast4Invalid] = useState(false);

  const onAdd = async () => {
    if (!channel.trim()) return;
    // Validate at the form boundary (the backend mirrors it with a 400).
    if (matchKind === 'card_last4' && !/^\d{4}$/.test(last4)) return setLast4Invalid(true);
    setLast4Invalid(false);
    try {
      await addAlias({
        source_id: sourceId,
        channel: channel.trim(),
        match_kind: matchKind,
        ...(matchKind === 'card_last4' ? { value: last4 } : {}),
      }).unwrap();
      setChannel('');
      setLast4('');
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  return (
    <>
      <SectionTitle>{t('sources.aliases')}</SectionTitle>
      <Muted style={styles.hint}>{t('sources.aliasHint')}</Muted>

      <QueryBoundary
        isLoading={isLoading && !aliases}
        error={error}
        isEmpty={!!aliases && aliases.length === 0}
        emptyText={t('sources.noAliases')}
        onRetry={refetch}
      >
        {aliases?.map((alias) => (
          <Card key={alias.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.channel}>{alias.channel}</Text>
                <Muted style={styles.meta}>
                  {alias.match_kind === 'card_last4'
                    ? `${t('sources.match_card_last4')} · ${alias.value}`
                    : t('sources.match_channel_default')}
                </Muted>
              </View>
              <Pressable hitSlop={10} onPress={() => deleteAlias({ id: alias.id })}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}
      </QueryBoundary>

      <Card>
        <Field
          label={t('sources.channel')}
          value={channel}
          onChangeText={setChannel}
          placeholder="google_wallet"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>{t('sources.matchKind')}</Text>
        <View style={styles.row}>
          {MATCH_KINDS.map((mk) => (
            <Chip key={mk} label={t(`sources.match_${mk}`)} active={matchKind === mk} onPress={() => setMatchKind(mk)} />
          ))}
        </View>
        {matchKind === 'card_last4' ? (
          <Field label={t('sources.last4')} value={last4} onChangeText={setLast4} keyboardType="number-pad" placeholder="0347" maxLength={4} />
        ) : null}
        {last4Invalid ? <Muted style={styles.err}>{t('sources.invalidLast4')}</Muted> : null}
        <AppButton title={t('sources.addAlias')} onPress={onAdd} loading={adding} disabled={!channel.trim()} />
      </Card>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    channel: { fontSize: font.md, fontWeight: '600', color: colors.text },
    meta: { marginTop: spacing(0.25) },
    hint: { marginBottom: spacing(1) },
    err: { color: colors.danger, marginBottom: spacing(1.5) },
  });
