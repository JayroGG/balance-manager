import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '../../services/api/categories';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, Card, Field, Chip, AppButton, SectionTitle, QueryBoundary, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

const KINDS = ['income', 'expense', 'both'];

export default function Categories() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  // RBAC: guest is read-only; member can add but edits/deletes only its own categories; owner does all.
  // canEditRow checks row.user_id — if the backend doesn't stamp categories, members simply can't edit
  // team categories (conservative), and the API 403s a violation regardless (ADR-012).
  const { canAdd, canEditRow } = usePermissions();
  const { data, isLoading, error, refetch } = useGetCategoriesQuery(teamId);
  const [addCategory, { isLoading: adding }] = useAddCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const [editing, setEditing] = useState(null); // null | category
  const [name, setName] = useState('');
  const [kind, setKind] = useState('both');

  const reset = () => {
    setEditing(null);
    setName('');
    setKind('both');
  };

  // `editing` holds a category id from the current context — clear the inline form if it switches, or a
  // Save would target the old id in the new context (403/404).
  useOnContextChange(reset);

  const startEdit = (cat) => {
    setEditing(cat);
    setName(cat.name);
    setKind(cat.kind);
  };

  const submit = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim(), kind };
    try {
      if (editing) await updateCategory({ id: editing.id, ...body, team_id: teamId }).unwrap();
      else await addCategory({ ...body, team_id: teamId }).unwrap();
      reset();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onDelete = (cat) => {
    Alert.alert(t('categories.deleteConfirm'), cat.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory({ id: cat.id, team_id: teamId }).unwrap();
            if (editing?.id === cat.id) reset();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  const grouped = KINDS.map((k) => ({ kind: k, items: (data ?? []).filter((c) => c.kind === k) }));

  return (
    <Screen scroll>
      <ScreenHeader back title={t('categories.title')} />

      {canAdd ? (
        <Card>
          <Field label={t('categories.name')} value={name} onChangeText={setName} placeholder="—" />
          <Text style={styles.label}>{t('categories.kind')}</Text>
          <View style={styles.row}>
            {KINDS.map((k) => (
              <Chip key={k} label={t(`categories.${k}`)} active={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <View style={styles.row}>
            <AppButton
              title={editing ? t('common.save') : t('common.create')}
              onPress={submit}
              loading={adding || updating}
              disabled={!name.trim()}
              style={{ flex: 1, marginRight: editing ? spacing(1) : 0 }}
            />
            {editing ? <AppButton title={t('common.cancel')} variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
          </View>
        </Card>
      ) : null}

      <QueryBoundary isLoading={isLoading && !data} error={error} onRetry={refetch}>
        {grouped.map(({ kind: k, items }) =>
          items.length ? (
            <View key={k}>
              <SectionTitle>{t(`categories.${k}`)}</SectionTitle>
              {items.map((c) => (
                <Card key={c.id} onPress={canEditRow(c) ? () => startEdit(c) : undefined}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.name}>{c.name}</Text>
                    {canEditRow(c) ? (
                      <Pressable hitSlop={10} onPress={() => onDelete(c)}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : null,
        )}
        {!!data && data.length === 0 ? <Muted>{t('categories.empty')}</Muted> : null}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing(0.5) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: font.md, fontWeight: '600', color: colors.text },
});
