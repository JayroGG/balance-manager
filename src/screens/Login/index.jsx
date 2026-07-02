import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed, setToken, setUser } from '../../reducers/auth';
import { useLoginMutation } from '../../services/api/auth';
import { setToken as persistToken } from '../../services/storage/secure';
import { decodeUser } from '../../utils/jwt';
import { Screen, Field, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, spacing } from '../../components/theme';

// Email/password → JWT. The token lands in secure-store + the auth slice (the single token seam reads it).
// A bad password 401s on /auth/login, which is exempt from the auto-logout — we render its message inline.
export default function Login() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const authed = useSelector(selectIsAuthed);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [login, { isLoading }] = useLoginMutation();

  if (authed) return <Redirect href="/(tabs)/dashboard" />;

  const submit = async () => {
    setErrorMessage(null);
    try {
      const { token } = await login({ email: email.trim(), password }).unwrap();
      await persistToken(token);
      dispatch(setToken(token));
      dispatch(setUser(decodeUser(token))); // myUserId for member RBAC (ADR-012)
    } catch (err) {
      setErrorMessage(err?.message ?? t('auth.invalidCredentials'));
    }
  };

  const canSubmit = email.trim() !== '' && password !== '';

  return (
    <Screen>
      <View style={styles.wrap}>
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
          secureTextEntry
          placeholder="••••••••"
        />
        {errorMessage ? <Muted style={styles.err}>{errorMessage}</Muted> : null}
        <AppButton
          title={t('auth.signIn')}
          onPress={submit}
          loading={isLoading}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing(0.5) },
  title: {
    fontSize: font.hero,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing(3),
  },
  err: { color: colors.danger, marginBottom: spacing(1.5) },
});
