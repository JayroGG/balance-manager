import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Screen, AppButton, Field, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useAppLock } from '../../hooks/useAppLock';
import { hardLogout } from '../../services/api/hardLogout';
import { authApi } from '../../services/api/auth';
import { selectIsAuthed } from '../../reducers/auth';
import { unlockApp, usePasswordInstead } from '../../reducers/lock';
import { font, spacing } from '../../components/theme';

// Mandatory lock (ADR-027 addendum): full-screen, renders nothing of the account. With a session the unlock is
// biometric (when enabled; the OS prompt opens as soon as it appears) or the account password, verified by the
// backend (POST /auth/step-up: checks the password, rotates nothing). No client-side check and no bypass: a wrong
// password or a network failure leaves it locked. "Log out" is always available.
// A dead session (refresh token rejected/missing) cannot be unlocked by password: the lock ends it and shows Login.
// Without a session (logged out, biometric creds stored) the biometric prompt logs in with the stored creds, and
// "Use password" goes to the Login form.
export default function Lock() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { authenticate, busy, error } = useAppLock();
  const authed = useSelector(selectIsAuthed);
  const email = useSelector((s) => s.auth?.user?.email) ?? '';
  const biometric = useSelector((s) => s.lock.enabled);
  const [passwordMode, setPasswordMode] = useState(authed && !biometric);
  const [password, setPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    if (!passwordMode) authenticate();
  }, [authenticate, passwordMode]);

  const verify = async () => {
    if (pwBusy || !password) return;
    setPwBusy(true);
    setPwError(null);
    try {
      // track:false keeps the password (arg) and the permit (result) out of redux mutation state (redux-persist)
      await dispatch(authApi.endpoints.stepUp.initiate({ password }, { track: false })).unwrap();
      dispatch(unlockApp());
    } catch (err) {
      const status = err?.status;
      if (err?.refresh === 'invalid') {
        // the session itself is dead (refresh token gone/rejected): no password can unlock it. End it and go to Login.
        await hardLogout(dispatch);
        dispatch(usePasswordInstead());
        return;
      }
      if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || err?.refresh === 'transient') setPwError(t('auth.networkError'));
      else if ([400, 401, 403, 422].includes(status)) setPwError(t('auth.invalidCredentials'));
      else setPwError(t('common.error'));
    } finally {
      if (alive.current) setPwBusy(false);
    }
  };

  const onUsePassword = async () => {
    if (authed) {
      setPasswordMode(true);
      return;
    }
    await hardLogout(dispatch);
    dispatch(usePasswordInstead());
  };

  const onLogout = async () => {
    await hardLogout(dispatch);
    dispatch(usePasswordInstead());
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('auth.lockTitle')}</Text>
        {passwordMode ? (
          <>
            <Muted style={styles.msg}>{t('auth.lockPasswordBody')}</Muted>
            <Field label={t('auth.email')} value={email} editable={false} autoCapitalize="none" />
            <Field
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              testID="lock-password"
              onSubmitEditing={verify}
            />
            {pwError ? (
              <Text style={styles.err} testID="lock-error" accessibilityRole="alert" accessibilityLiveRegion="polite">{pwError}</Text>
            ) : null}
            <AppButton
              title={pwError === t('auth.networkError') ? t('common.retry') : t('auth.unlock')}
              onPress={verify}
              disabled={pwBusy || !password}
              loading={pwBusy}
            />
            {biometric ? (
              <AppButton title={t('auth.useBiometric')} variant="ghost" onPress={() => setPasswordMode(false)} disabled={pwBusy} />
            ) : null}
          </>
        ) : (
          <>
            {busy ? <Muted style={styles.msg}>{t('auth.unlocking')}</Muted> : null}
            {error ? <Muted style={styles.err}>{error}</Muted> : null}
            <AppButton title={t('auth.tryAgain')} onPress={authenticate} disabled={busy} />
            <AppButton title={t('auth.usePassword')} variant="ghost" onPress={onUsePassword} disabled={busy} />
          </>
        )}
        {authed ? <AppButton title={t('auth.logout')} variant="ghost" onPress={onLogout} disabled={pwBusy || busy} /> : null}
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
