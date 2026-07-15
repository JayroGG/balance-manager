import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useGetEventsQuery } from '../../services/api/events';
import { useGetBalanceQuery } from '../../services/api/balance';
import { markSeen, contextKey, selectLastSeen } from '../../reducers/activity';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useIdToken } from '../../hooks/useIdToken';
import { decodeUser } from '../../utils/jwt';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Card, QueryBoundary } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { timeAgo } from '../../utils/dates';
import { eventMessage, eventHref } from '../../utils/activity';

const ENTITY_ICON = {
  transaction: 'swap-horizontal-outline',
  vault: 'wallet-outline',
  shopping_list: 'cart-outline',
  shopping_list_item: 'cart-outline',
  team: 'people-outline',
};

export default function Activity() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const token = useIdToken();
  const myUserId = decodeUser(token)?.id;
  const lastSeen = useSelector((s) => selectLastSeen(s, teamId));
  const { data, isLoading, error, refetch } = useGetEventsQuery({ team_id: teamId });
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;

  // Opening the feed marks it seen: newest first, so the top row is the highest id (ADR-017).
  useEffect(() => {
    if (!data) return;
    const top = data[0]?.id ?? 0; // empty feed seeds 0 so the badge activates from then on
    if (lastSeen == null || top > lastSeen) dispatch(markSeen({ key: contextKey(teamId), id: top }));
  }, [data, lastSeen, teamId, dispatch]);

  // Drive the spinner only from a user pull — not the auto refetch-on-mount, which on iOS
  // leaves a programmatic RefreshControl spinner stuck until the user drags.
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
    const actor = item.user_id === myUserId ? t('activity.you') : item.actor_email;
    const message = eventMessage(item, { t, actor, currency });
    const meta = timeAgo(item.created_at, i18n.language);
    const icon = ENTITY_ICON[item.entity] || 'ellipse-outline';
    const href = eventHref(item);
    const content = (
      <Card>
        <View style={styles.row}>
          <Ionicons name={icon} size={20} color={colors.primary} style={styles.icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.meta}>{meta}</Text>
          </View>
        </View>
      </Card>
    );
    if (!href) return content;
    return <Pressable onPress={() => router.push(href)}>{content}</Pressable>;
  };

  return (
    <Screen padded={false}>
      <ScreenHeader back title={t('activity.title')} style={styles.headerPad} />

      <QueryBoundary
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!!data && data.length === 0}
        emptyText={t('activity.empty')}
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
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    headerPad: { paddingHorizontal: spacing(2), marginBottom: 0 },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    icon: { marginRight: spacing(1.25), marginTop: spacing(0.25) },
    message: { fontSize: font.md, fontWeight: '600', color: colors.text },
    meta: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.25) },
  });
