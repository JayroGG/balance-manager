import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Screen, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useAppLock } from '../../hooks/useAppLock';
import { hardLogout } from '../../services/api/hardLogout';
import { usePasswordInstead } from '../../reducers/lock';
import { font, spacing } from '../../components/theme';

// Full-screen lock. Renders nothing of the account; the OS prompt opens as soon as it appears.
export default function Lock() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { authenticate, busy, error } = useAppLock();

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  const onUsePassword = async () => {
    await hardLogout(dispatch);
    dispatch(usePasswordInstead());
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('auth.lockTitle')}</Text>
        {busy ? <Muted style={styles.msg}>{t('auth.unlocking')}</Muted> : null}
        {error ? <Muted style={styles.err}>{error}</Muted> : null}
        <AppButton title={t('auth.tryAgain')} onPress={authenticate} disabled={busy} />
        <AppButton title={t('auth.usePassword')} variant="ghost" onPress={onUsePassword} disabled={busy} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center', gap: spacing(1) },
    title: { fontSize: font.hero, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing(3) },
    msg: { textAlign: 'center' },
    err: { color: colors.danger, textAlign: 'center' },
  });
