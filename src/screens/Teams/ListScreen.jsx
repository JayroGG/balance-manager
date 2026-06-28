import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTeamsQuery, useCreateTeamMutation } from '../../services/api/teams';
import { Screen, Card, Field, AppButton, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';

// Teams list — the entry point to team management (ADR-012). Grouped by role: teams you OWN (tap →
// owner Manage screen) vs teams you were invited to (tap → read-only member list). Any user can create.
export default function TeamsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: teams, isLoading, error, refetch } = useGetTeamsQuery();
  const [createTeam, { isLoading: creating }] = useCreateTeamMutation();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await createTeam({ name: name.trim() }).unwrap();
      setName('');
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
      <View style={styles.header}>
        <Text style={styles.h1}>{t('teams.title')}</Text>
        <Pressable hitSlop={10} onPress={() => setAdding((v) => !v)}>
          <Ionicons name={adding ? 'close' : 'add'} size={26} color={colors.primary} />
        </Pressable>
      </View>

      {adding ? (
        <Card>
          <Field label={t('teams.name')} value={name} onChangeText={setName} placeholder="—" autoFocus />
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing(1.5) },
  h1: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  right: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text, flex: 1 },
  role: { textTransform: 'capitalize', marginRight: spacing(0.75) },
});
