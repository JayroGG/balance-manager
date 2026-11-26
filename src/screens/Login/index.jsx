import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed } from '../../reducers/auth';
import { useLoginMutation } from '../../services/api/auth';
import { saveSession } from '../../services/api/session';
import { saveStoredCreds, canUseBiometrics, isOptedOut, isBiometricEnabled } from '../../services/storage/biometric';
import { setLockEnabled, clearRejected, clearPasswordOnly } from '../../reducers/lock';
import { useAppLock } from '../../hooks/useAppLock';
import { Screen, Field, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Email/password → JWT. The token lands in secure-store + the auth slice (the single token seam reads it).
// A bad password 401s on /auth/login, which is exempt from the auto-logout — we render its message inline.
export default function Login() {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const authed = useSelector(selectIsAuthed);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [login, { isLoading }] = useLoginMutation();
  const { enabled, passwordOnly, rejected } = useSelector((s) => s.lock);
  const { authenticate, busy: unlocking } = useAppLock();

  // Logged out with fingerprint creds stored: open the OS prompt right away (not after "Use password").
  // Re-check the keychain flag first: boot state may have missed it (keychain not ready at cold start).
  useEffect(() => {
    (async () => {
      let on = enabled;
      if (!on && !authed && (await isBiometricEnabled())) {
        dispatch(setLockEnabled(true));
        on = true;
      }
      if (on && !passwordOnly && !authed) authenticate();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authed) return <Redirect href="/(tabs)/dashboard" />;

  const submit = async () => {
    setErrorMessage(null);
    try {
      const creds = { email: email.trim(), password };
      const res = await login(creds).unwrap();
      try {
        if (!(await isOptedOut()) && (await canUseBiometrics())) {
          await saveStoredCreds(creds);
          dispatch(setLockEnabled(true));
        }
      } catch {
        // keychain/biometric failure must never block a successful login
      }
      dispatch(clearRejected());
      await saveSession(res, dispatch); // tokens + myUserId for member RBAC (ADR-012)
    } catch (err) {
      setErrorMessage(err?.message ?? t('auth.invalidCredentials'));
    }
  };

  const canSubmit = email.trim() !== '' && password !== '';

  return (
    <Screen>
      <View style={styles.wrap}>
        <Image
          source={
            scheme === 'dark'
              ? require('../../../assets/splash-icon-dark.png')
              : require('../../../assets/splash-icon.png')
          }
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t('common.appName')}</Text>
        <Field
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
        />
        <Field
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••••"
          right={
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              style={styles.eye}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.muted}
              />
            </Pressable>
          }
        />
        {rejected && !errorMessage ? <Muted style={styles.err}>{t('auth.storedCredsRejected')}</Muted> : null}
        {errorMessage ? <Muted style={styles.err}>{errorMessage}</Muted> : null}
        <AppButton
          title={t('auth.signIn')}
          onPress={submit}
          loading={isLoading}
          disabled={!canSubmit}
        />
        {enabled ? (
          <AppButton
            title={t('auth.useBiometric')}
            variant="ghost"
            onPress={() => {
              dispatch(clearPasswordOnly());
              authenticate();
            }}
            loading={unlocking}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  wrap: { flex: 1, justifyContent: 'center', gap: spacing(0.5) },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: spacing(2) },
  title: {
    fontSize: font.hero,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing(3),
  },
  err: { color: colors.danger, marginBottom: spacing(1.5) },
});
