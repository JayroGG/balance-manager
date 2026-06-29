import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetTeamsQuery,
  useGetMembersQuery,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useAddMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} from '../../services/api/teams';
import { Screen, Card, Field, Chip, AppButton, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';

const ROLES = ['owner', 'member', 'guest'];

// Team management (ADR-012). Owner-gated: an owner gets rename / add / change-role / remove / delete;
// any other member sees a read-only member list. The team's role comes from GET /teams (cached); the
// member list from GET /teams/:id/members. The API enforces the same rules and 4xxs on a violation.
export default function ManageTeam() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: teams } = useGetTeamsQuery();
  const team = teams?.find((tm) => String(tm.id) === String(id));
  const isOwner = team?.role === 'owner';

  // The screen reads the team from the GET /teams cache. Once that resolves and the team isn't in it
  // (deleted, or you were removed), bail to the list instead of rendering an empty, controls-less shell.
  useEffect(() => {
    if (teams && !team) router.back();
  }, [teams, team, router]);

  const { data: members, isLoading, error, refetch } = useGetMembersQuery(id);

  const [updateTeam, { isLoading: renaming }] = useUpdateTeamMutation();
  const [deleteTeam, { isLoading: deletingTeam }] = useDeleteTeamMutation();
  const [addMember, { isLoading: addingMember, error: addError }] = useAddMemberMutation();
  const [updateMemberRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [menuFor, setMenuFor] = useState(null); // user_id of the expanded member row

  const ownerCount = (members ?? []).filter((m) => m.role === 'owner').length;

  // Add-by-email returns 404 "User not found" when the email has no account — show a friendlier,
  // localized message; fall back to the backend's string otherwise (ADR-012, confirmed by BE).
  const addErrorMessage = addError
    ? addError.status === 404
      ? t('teams.noAccountForEmail')
      : addError.message
    : null;

  const onRename = async () => {
    if (!name.trim()) return;
    try {
      await updateTeam({ id, name: name.trim() }).unwrap();
      setEditingName(false);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onAdd = async () => {
    if (!addEmail.trim()) return;
    try {
      await addMember({ id, email: addEmail.trim(), role: addRole }).unwrap();
      setAddEmail('');
      setAddRole('member');
    } catch {
      // surfaced inline via addError below (404 = "no account for that email")
    }
  };

  const onChangeRole = async (member, role) => {
    if (role === member.role) return setMenuFor(null);
    try {
      await updateMemberRole({ id, userId: member.user_id, role }).unwrap();
      setMenuFor(null);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onRemove = (member) => {
    Alert.alert(t('teams.removeConfirm'), member.email, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teams.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember({ id, userId: member.user_id }).unwrap();
            setMenuFor(null);
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  const onDeleteTeam = () => {
    Alert.alert(t('teams.deleteConfirm'), team?.name ?? '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTeam({ id }).unwrap();
            router.back(); // back to the list; the tabs guard resets context to personal if this was active
          } catch (e) {
            // 400 when the team still has transactions/vaults
            Alert.alert(t('common.error'), e?.message ?? t('teams.deleteNotEmpty'));
          }
        },
      },
    ]);
  };

  const MemberRow = ({ member }) => {
    const soleOwner = member.role === 'owner' && ownerCount === 1;
    const open = menuFor === member.user_id;
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.email} numberOfLines={1}>{member.email}</Text>
            <Muted style={styles.role}>{t(`teams.role_${member.role}`)}</Muted>
          </View>
          {isOwner ? (
            <Pressable hitSlop={10} onPress={() => setMenuFor(open ? null : member.user_id)}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {isOwner && open ? (
          <View style={styles.menu}>
            <View style={styles.row}>
              {ROLES.map((r) => (
                <Chip
                  key={r}
                  label={t(`teams.role_${r}`)}
                  active={member.role === r}
                  // Don't let the sole owner be demoted (the API 400s too).
                  onPress={soleOwner && r !== 'owner' ? undefined : () => onChangeRole(member, r)}
                />
              ))}
            </View>
            {soleOwner ? (
              <Muted>{t('teams.lastOwner')}</Muted>
            ) : (
              <AppButton title={t('teams.remove')} variant="danger" onPress={() => onRemove(member)} />
            )}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen scroll>
      {editingName && isOwner ? (
        <Card>
          <Field label={t('teams.name')} value={name} onChangeText={setName} autoFocus />
          <View style={styles.row}>
            <AppButton title={t('common.save')} onPress={onRename} loading={renaming} disabled={!name.trim()} style={{ flex: 1, marginRight: spacing(1) }} />
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setEditingName(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <View style={styles.titleRow}>
          <Text style={styles.h1} numberOfLines={1}>{team?.name ?? ''}</Text>
          {isOwner ? (
            <Pressable hitSlop={10} onPress={() => { setName(team?.name ?? ''); setEditingName(true); }}>
              <Text style={styles.rename}>{t('teams.rename')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <SectionTitle>{t('teams.members')}</SectionTitle>
      <QueryBoundary
        isLoading={isLoading && !members}
        error={error}
        isEmpty={!!members && members.length === 0}
        emptyText={t('teams.noMembers')}
        onRetry={refetch}
      >
        {members?.map((m) => <MemberRow key={m.user_id} member={m} />)}
      </QueryBoundary>

      {isOwner ? (
        <>
          <SectionTitle>{t('teams.addMember')}</SectionTitle>
          <Card>
            <Field
              label={t('auth.email')}
              value={addEmail}
              onChangeText={setAddEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
            />
            <Text style={styles.label}>{t('teams.role')}</Text>
            <View style={styles.row}>
              {ROLES.map((r) => (
                <Chip key={r} label={t(`teams.role_${r}`)} active={addRole === r} onPress={() => setAddRole(r)} />
              ))}
            </View>
            {addErrorMessage ? <Muted style={styles.err}>{addErrorMessage}</Muted> : null}
            <AppButton title={t('teams.add')} onPress={onAdd} loading={addingMember} disabled={!addEmail.trim()} />
          </Card>

          <AppButton title={t('teams.deleteTeam')} variant="danger" onPress={onDeleteTeam} loading={deletingTeam} style={{ marginTop: spacing(2) }} />
          <Muted style={{ marginTop: spacing(1) }}>{t('teams.deleteNotEmpty')}</Muted>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing(1.5) },
  h1: { fontSize: font.xl, fontWeight: '800', color: colors.text, flex: 1, marginRight: spacing(1) },
  rename: { color: colors.primary, fontWeight: '700', fontSize: font.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing(0.5) },
  email: { fontSize: font.md, fontWeight: '600', color: colors.text },
  role: { textTransform: 'capitalize', marginTop: spacing(0.25) },
  menu: { marginTop: spacing(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5) },
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  err: { color: colors.danger, marginBottom: spacing(1.5) },
});
