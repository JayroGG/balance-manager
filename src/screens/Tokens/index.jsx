import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGetTokensQuery, useCreateTokenMutation, useRevokeTokenMutation } from '../../services/api/tokens';
import { Screen, ScreenHeader, Card, Field, AppButton, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';
import { formatDate } from '../../utils/dates';

// Automation tokens (ADR-014): mint / list / revoke the ingest-scoped credentials that
// iOS Shortcuts / MacroDroid use to POST /captures. The secret appears ONCE at mint time
// (long-press the selectable text to copy it into the automation); the list is metadata only.
export default function Tokens() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const { data: tokens, isLoading, error, refetch } = useGetTokensQuery();
  const [createToken, { isLoading: minting }] = useCreateTokenMutation();
  const [revokeToken] = useRevokeTokenMutation();

  const [name, setName] = useState('');
  const [minted, setMinted] = useState(null); // { id, name, token } — held until dismissed

  const onMint = async () => {
    if (!name.trim()) return;
    try {
      const res = await createToken({ name: name.trim() }).unwrap();
      setMinted(res);
      setName('');
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onRevoke = (token) => {
    Alert.alert(t('tokens.revokeConfirm'), token.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tokens.revoke'),
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeToken({ id: token.id }).unwrap();
            if (minted?.id === token.id) setMinted(null);
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('tokens.title')} />
      <Muted style={styles.hint}>{t('tokens.hint')}</Muted>

      {minted ? (
        <Card style={styles.mintedCard}>
          <Text style={styles.mintedTitle}>{minted.name}</Text>
          <Muted style={styles.mintedWarn}>{t('tokens.shownOnce')}</Muted>
          <Text selectable style={styles.secret}>{minted.token}</Text>
          <AppButton title={t('tokens.done')} variant="ghost" onPress={() => setMinted(null)} />
        </Card>
      ) : (
        <Card>
          <Field
            label={t('tokens.name')}
            value={name}
            onChangeText={setName}
            placeholder="iphone-shortcut"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppButton title={t('tokens.mint')} onPress={onMint} loading={minting} disabled={!name.trim()} />
        </Card>
      )}

      <SectionTitle>{t('tokens.active')}</SectionTitle>
      <QueryBoundary
        isLoading={isLoading && !tokens}
        error={error}
        isEmpty={!!tokens && tokens.length === 0}
        emptyText={t('tokens.empty')}
        onRetry={refetch}
      >
        {tokens?.map((token) => (
          <Card key={token.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{token.name}</Text>
                <Muted style={styles.meta}>
                  {t('tokens.issued')} {formatDate(token.issued_at)} · {t('tokens.expires')} {formatDate(token.expires_at)}
                </Muted>
              </View>
              <Pressable hitSlop={10} onPress={() => onRevoke(token)} testID={`revoke-${token.id}`}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    hint: { marginBottom: spacing(1.5) },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: font.md, fontWeight: '700', color: colors.text },
    meta: { marginTop: spacing(0.25) },
    mintedCard: { borderColor: colors.primary, borderWidth: 1 },
    mintedTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
    mintedWarn: { marginTop: spacing(0.5), marginBottom: spacing(1) },
    secret: {
      color: colors.text,
      fontSize: font.sm,
      fontFamily: 'monospace',
      backgroundColor: colors.bg,
      borderRadius: 6,
      padding: spacing(1),
      marginBottom: spacing(1.5),
    },
  });
