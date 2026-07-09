import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetShoppingListsQuery,
  useAddShoppingListMutation,
} from '../../services/api/shoppingLists';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Card, Field, AppButton, Chip, Muted, QueryBoundary } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { formatDate } from '../../utils/dates';

const STATUS_FILTERS = ['open', 'purchased'];

// Pre-expense checklists (ADR-015). A list is context-scoped like transactions — pass team_id into
// every hook so personal/team caches stay isolated. Tapping a list opens its items + checkout.
export default function ShoppingListsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [status, setStatus] = useState('open');
  const { data, isLoading, error, refetch } = useGetShoppingListsQuery({ status, team_id: teamId });

  const [addList, { isLoading: creating }] = useAddShoppingListMutation();
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState('');

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await addList({ name: name.trim(), team_id: teamId }).unwrap();
      setName('');
      setComposing(false);
      router.push({ pathname: '/(tabs)/transactions/lists/[id]', params: { id: created.id } });
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderItem = ({ item }) => {
    const total = item.item_count ?? item.items_total ?? null;
    const done = item.checked_count ?? null;
    return (
      <Card onPress={() => router.push({ pathname: '/(tabs)/transactions/lists/[id]', params: { id: item.id } })}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.metaRow}>
              {done != null && total != null ? (
                <Text style={styles.meta}>{t('lists.progress', { done, total })}</Text>
              ) : null}
              {item.status === 'purchased' ? (
                <Text style={styles.badge}>{t('lists.purchased')} · {formatDate(item.updated_at)}</Text>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>
      </Card>
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader back title={t('lists.title')} style={styles.headerPad} />

      <View style={styles.filters}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} label={t(`lists.${s}`)} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      {composing ? (
        <View style={styles.composer}>
          <Field label={t('lists.new')} value={name} onChangeText={setName} placeholder={t('lists.namePlaceholder')} autoFocus />
          <AppButton title={t('common.create')} onPress={onCreate} loading={creating} disabled={!name.trim()} />
        </View>
      ) : null}

      <QueryBoundary
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!!data && data.length === 0}
        emptyText={t('lists.empty')}
        onRetry={refetch}
      >
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing(2), paddingBottom: spacing(10) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </QueryBoundary>

      {canAdd ? (
        <Pressable style={styles.fab} onPress={() => setComposing((c) => !c)}>
          <Ionicons name={composing ? 'close' : 'add'} size={28} color={colors.primaryText} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing(2), paddingTop: spacing(1) },
    composer: { paddingHorizontal: spacing(2), paddingBottom: spacing(1) },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: font.md, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(0.25), gap: spacing(0.75), flexWrap: 'wrap' },
    meta: { fontSize: font.sm, color: colors.muted },
    badge: { fontSize: font.sm, color: colors.muted },
    fab: {
      position: 'absolute',
      right: spacing(2.5),
      bottom: spacing(3),
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
  });
