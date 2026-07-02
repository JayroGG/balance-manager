import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTeamsQuery, useCreateTeamMutation } from '../../services/api/teams';
import { Screen, ScreenHeader, Card, Field, ColorSwatchPicker, AppButton, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { PRESET_TEAM_COLORS, font, spacing } from '../../components/theme';
import { isValidHex, normalizeHex } from '../../utils/colors';

// Teams list — the entry point to team management (ADR-012). Grouped by role: teams you OWN (tap →
// owner Manage screen) vs teams you were invited to (tap → read-only member list). Any user can create.
// Each team carries a color that themes the app while it's the active context (ADR-013).
export default function TeamsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: teams, isLoading, error, refetch } = useGetTeamsQuery();
  const [createTeam, { isLoading: creating }] = useCreateTeamMutation();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_TEAM_COLORS[0]);
  const [colorInvalid, setColorInvalid] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) return;
    // Validate the custom hex at the boundary; empty = no color (backend stores null).
    if (color && !isValidHex(color)) return setColorInvalid(true);
    setColorInvalid(false);
    try {
      await createTeam({ name: name.trim(), color: color ? normalizeHex(color) : undefined }).unwrap();
      setName('');
      setColor(PRESET_TEAM_COLORS[0]);
      setAdding(false);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const owned = (teams ?? []).filter((tm) => tm.role === 'owner');
  const memberOf = (teams ?? []).filter((tm) => tm.role && tm.role !== 'owner');

  const Item = ({ team }) => (
    <Card onPress={() => router.push(`/(tabs)/teams/${team.id}`)}>
      <View style={styles.rowBetween}>
        <View style={[styles.dot, { backgroundColor: team.color ?? colors.border }]} />
        <Text style={styles.name}>{team.name}</Text>
        <View style={styles.right}>
          <Muted style={styles.role}>{t(`teams.role_${team.role}`)}</Muted>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </View>
    </Card>
  );

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('teams.title')}
        right={
          <Pressable hitSlop={10} onPress={() => setAdding((v) => !v)}>
            <Ionicons name={adding ? 'close' : 'add'} size={26} color={colors.primary} />
          </Pressable>
        }
      />

      {adding ? (
        <Card>
          <Field label={t('teams.name')} value={name} onChangeText={setName} placeholder="—" autoFocus />
          <ColorSwatchPicker
            label={t('teams.color')}
            value={color}
            onChange={(next) => {
              setColor(next);
              setColorInvalid(false);
            }}
          />
          {colorInvalid ? <Muted style={styles.err}>{t('teams.invalidColor')}</Muted> : null}
          <AppButton title={t('teams.create')} onPress={onCreate} loading={creating} disabled={!name.trim()} />
        </Card>
      ) : null}

      <QueryBoundary
        isLoading={isLoading && !teams}
        error={error}
        isEmpty={!!teams && teams.length === 0}
        emptyText={t('teams.empty')}
        onRetry={refetch}
      >
        {owned.length ? (
          <>
            <SectionTitle>{t('teams.owned')}</SectionTitle>
            {owned.map((team) => <Item key={team.id} team={team} />)}
          </>
        ) : null}
        {memberOf.length ? (
          <>
            <SectionTitle>{t('teams.memberOf')}</SectionTitle>
            {memberOf.map((team) => <Item key={team.id} team={team} />)}
          </>
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    right: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 999, marginRight: spacing(1) },
    name: { fontSize: font.md, fontWeight: '700', color: colors.text, flex: 1 },
    role: { textTransform: 'capitalize', marginRight: spacing(0.75) },
    err: { color: colors.danger, marginBottom: spacing(1.5) },
  });
