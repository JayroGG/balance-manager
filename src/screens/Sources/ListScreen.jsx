import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetSourcesQuery } from '../../services/api/sources';
import { useGetTeamsQuery } from '../../services/api/teams';
import { Screen, ScreenHeader, Card, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Payment sources — the user's pots of money (accounts / credit cards) that auto-captured
// notifications resolve to. Each row shows its routing rule: which context (personal or a team)
// its transactions land in (ADR-014). User-scoped: the list is identical in every context.
export default function SourcesList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: sources, isLoading, error, refetch } = useGetSourcesQuery();
  const { data: teams } = useGetTeamsQuery();

  const routeLabel = (source) =>
    source.target_team_id == null
      ? t('context.personal')
      : teams?.find((tm) => tm.id === source.target_team_id)?.name ?? `#${source.target_team_id}`;

  return (
    <Screen scroll>
      <ScreenHeader
        back
        title={t('sources.title')}
        right={
          <Pressable hitSlop={10} onPress={() => router.push('/(tabs)/settings/source')}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </Pressable>
        }
      />

      <QueryBoundary
        isLoading={isLoading && !sources}
        error={error}
        isEmpty={!!sources && sources.length === 0}
        emptyText={t('sources.empty')}
        onRetry={refetch}
      >
        {sources?.map((source) => (
          <Card key={source.id} onPress={() => router.push({ pathname: '/(tabs)/settings/source', params: { id: source.id } })}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{source.name}</Text>
                <Muted style={styles.meta}>
                  {t(`sources.type_${source.type}`)}
                  {source.bank ? ` · ${source.bank}` : ''}
                </Muted>
              </View>
              <View style={styles.right}>
                <Muted>{routeLabel(source)}</Muted>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </View>
          </Card>
        ))}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    right: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
    name: { fontSize: font.md, fontWeight: '700', color: colors.text },
    meta: { marginTop: spacing(0.25) },
  });
