import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGetCapturesQuery, useConfirmCaptureMutation, useDiscardCaptureMutation } from '../../services/api/captures';
import { useGetSourcesQuery } from '../../services/api/sources';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { Screen, ScreenHeader, Card, Chip, AppButton, MoneyText, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDateTime } from '../../utils/dates';

// Review inbox (ADR-014): captures the pipeline could not auto-post (unknown card/app, ambiguous
// dedup, or a failed post). Linking one to a source posts its transaction — and teaches nothing
// server-side by itself; add an alias in the source screen to auto-route future captures.
export default function Inbox() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const { data: captures, isLoading, error, refetch } = useGetCapturesQuery({ status: 'pending' });
  const { data: sources } = useGetSourcesQuery();
  const teamId = useActiveTeamId();
  const { data: balance } = useGetBalanceQuery(teamId); // just for the currency label
  const [confirmCapture, { isLoading: confirming }] = useConfirmCaptureMutation();
  const [discardCapture] = useDiscardCaptureMutation();

  const [openId, setOpenId] = useState(null); // capture with the source picker expanded
  const [sourceId, setSourceId] = useState(null);

  const onConfirm = async (capture) => {
    if (!sourceId) return;
    try {
      const res = await confirmCapture({ id: capture.id, source_id: sourceId }).unwrap();
      setOpenId(null);
      setSourceId(null);
      // The pipeline may still not post (e.g. window dedup) — tell the user what happened.
      if (res.status !== 'posted') Alert.alert(t('inbox.title'), t(`inbox.result_${res.status}`));
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onDiscard = (capture) => {
    Alert.alert(t('inbox.discardConfirm'), capture.merchant_raw ?? capture.channel, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('inbox.discard'),
        style: 'destructive',
        onPress: async () => {
          try {
            await discardCapture({ id: capture.id }).unwrap();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('inbox.title')} />
      <Muted style={styles.hint}>{t('inbox.hint')}</Muted>

      <QueryBoundary
        isLoading={isLoading && !captures}
        error={error}
        isEmpty={!!captures && captures.length === 0}
        emptyText={t('inbox.empty')}
        onRetry={refetch}
      >
        {captures?.map((capture) => {
          const open = openId === capture.id;
          return (
            <Card key={capture.id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {capture.merchant_raw ?? t('inbox.unknownMerchant')}
                  </Text>
                  <Muted style={styles.meta}>
                    {capture.channel}
                    {capture.last4 ? ` · ****${capture.last4}` : ''} · {formatDateTime(capture.captured_at)}
                  </Muted>
                </View>
                <MoneyText
                  amount={capture.direction === 'out' ? -capture.amount : capture.amount}
                  currency={balance?.currency}
                  style={[styles.amount, capture.direction === 'out' ? styles.out : styles.in]}
                />
              </View>

              {open ? (
                <View style={styles.menu}>
                  <Text style={styles.label}>{t('inbox.linkToSource')}</Text>
                  <View style={styles.row}>
                    {(sources ?? []).map((s) => (
                      <Chip key={s.id} label={s.name} active={sourceId === s.id} onPress={() => setSourceId(s.id)} />
                    ))}
                    {(sources ?? []).length === 0 ? <Muted>{t('inbox.noSources')}</Muted> : null}
                  </View>
                  <AppButton
                    title={t('common.confirm')}
                    onPress={() => onConfirm(capture)}
                    loading={confirming}
                    disabled={!sourceId}
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <AppButton
                    title={t('inbox.link')}
                    variant="ghost"
                    onPress={() => { setOpenId(capture.id); setSourceId(null); }}
                    style={{ flex: 1, marginRight: spacing(1) }}
                  />
                  <AppButton
                    title={t('inbox.discard')}
                    variant="danger"
                    onPress={() => onDiscard(capture)}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </Card>
          );
        })}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    hint: { marginBottom: spacing(1.5) },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
    merchant: { fontSize: font.md, fontWeight: '700', color: colors.text },
    meta: { marginTop: spacing(0.25) },
    amount: { fontSize: font.md, fontWeight: '700', marginLeft: spacing(1) },
    out: { color: colors.danger },
    in: { color: colors.success },
    actions: { flexDirection: 'row', marginTop: spacing(1.5) },
    menu: { marginTop: spacing(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5) },
    label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  });
