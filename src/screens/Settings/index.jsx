import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useLoginMutation, useLogoutMutation } from '../../services/api/auth';
import { hardLogout } from '../../services/api/hardLogout';
import { setThemeMode, selectThemeMode, THEME_MODES } from '../../reducers/prefs';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useTheme } from '../../hooks/useTheme';
import { persistor } from '../../store';
import { clearStoredCreds, saveStoredCreds, setOptOut, canUseBiometrics, promptBiometric } from '../../services/storage/biometric';
import { setLockEnabled } from '../../reducers/lock';
import { Config } from '../../utils/config';
import { LANGUAGES, changeLanguage } from '../../i18n';
import { Screen, ScreenHeader, Card, Chip, AppButton, SectionTitle, Field, Muted } from '../../components/ui';
import { font, spacing } from '../../components/theme';

const Row = ({ label, value }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

export default function Settings() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const bypass = useSelector((s) => s.auth.bypass);
  const themeMode = useSelector(selectThemeMode);
  const teamId = useActiveTeamId();
  const { data } = useGetBalanceQuery(teamId);
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const biometricOn = useSelector((s) => s.lock.enabled);

  const [login, { isLoading: verifying }] = useLoginMutation();
  const [enrolled, setEnrolled] = useState(true);
  useEffect(() => {
    canUseBiometrics().then(setEnrolled, () => setEnrolled(false));
  }, []);
  const [askCreds, setAskCreds] = useState(false);
  const [bioEmail, setBioEmail] = useState('');
  const [bioPassword, setBioPassword] = useState('');
  const [bioError, setBioError] = useState(null);

  // OFF deletes creds and records the opt-out (logins stop re-saving). ON asks for the account
  // credentials in a modal (cross-platform), verifies them with /auth/login, then needs a biometric match.
  const onToggleBiometric = async (next) => {
    if (next) {
      setBioError(null);
      setAskCreds(true);
      return;
    }
    await setOptOut(true);
    await clearStoredCreds();
    dispatch(setLockEnabled(false));
  };

  const closeModal = () => {
    setAskCreds(false);
    setBioPassword('');
  };

  const onConfirmBiometric = async () => {
    setBioError(null);
    const creds = { email: bioEmail.trim(), password: bioPassword };
    try {
      if (!(await canUseBiometrics())) {
        setBioError(t('settings.biometricUnavailable'));
        return;
      }
      await login(creds).unwrap();
      if (!(await promptBiometric(t('auth.biometricPrompt'))).success) return;
      await saveStoredCreds(creds);
      await setOptOut(false);
      dispatch(setLockEnabled(true));
      closeModal();
    } catch (err) {
      setBioError(err?.message ?? t('auth.invalidCredentials'));
    }
  };

  const onClearCache = async () => {
    await persistor.purge();
    Alert.alert(t('settings.clearCache'), '✓');
  };

  // Real logout: best-effort revoke, then the shared teardown (ADR-019) — same routine the 401
  // interceptor uses, so the two paths cannot diverge again.
  // themeMode is a device pref, not session data — deliberately NOT reset here (ADR-013).
  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // server-side revoke is best-effort; clear locally regardless
    }
    await hardLogout(dispatch);
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} />

      <Card>
        <Row label={t('settings.currency')} value={data?.currency ?? '—'} />
        <Row label={t('settings.environment')} value={Config.ENV} />
        {bypass ? <Row label={t('settings.auth')} value={t('settings.authBypassed')} /> : null}
      </Card>

      <Card>
        <Pressable
          style={styles.navRow}
          onPress={() => router.push('/(tabs)/settings/categories')}
        >
          <Text style={styles.value}>{t('categories.title')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <Pressable style={styles.navRow} onPress={() => router.push('/(tabs)/settings/cards')}>
          <Text style={styles.value}>{t('cards.title')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      </Card>

      <Card>
        <View style={styles.row}>
          <Text style={styles.value}>{t('settings.biometric')}</Text>
          <Switch value={biometricOn} onValueChange={onToggleBiometric} disabled={!biometricOn && !enrolled} />
        </View>
        <Text style={styles.label}>
          {t(biometricOn || enrolled ? 'settings.biometricHint' : 'settings.biometricUnavailable')}
        </Text>
      </Card>

      <Modal visible={askCreds} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.value}>{t('settings.biometric')}</Text>
            <Field
              label={t('auth.email')}
              value={bioEmail}
              onChangeText={setBioEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label={t('auth.password')}
              value={bioPassword}
              onChangeText={setBioPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {bioError ? <Muted style={{ color: colors.danger }}>{bioError}</Muted> : null}
            <AppButton
              title={t('auth.unlock')}
              onPress={onConfirmBiometric}
              loading={verifying}
              disabled={!bioEmail.trim() || !bioPassword}
            />
            <AppButton title={t('common.cancel')} variant="ghost" onPress={closeModal} />
          </View>
        </View>
      </Modal>

      {bypass ? null : (
        <AppButton
          title={t('auth.logout')}
          variant="danger"
          onPress={onLogout}
          loading={loggingOut}
          style={{ marginTop: spacing(2) }}
        />
      )}

      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <View style={styles.chipRow}>
        {THEME_MODES.map((mode) => (
          <Chip
            key={mode}
            label={t(`settings.theme_${mode}`)}
            active={themeMode === mode}
            onPress={() => dispatch(setThemeMode(mode))}
          />
        ))}
      </View>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <View style={styles.chipRow}>
        {LANGUAGES.map((l) => (
          <Chip key={l.key} label={l.label} active={i18n.language === l.key} onPress={() => changeLanguage(l.key)} />
        ))}
      </View>

      <AppButton title={t('settings.clearCache')} variant="ghost" onPress={onClearCache} style={{ marginTop: spacing(2) }} />
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing(0.75) },
    label: { color: colors.muted, fontSize: font.md },
    value: { color: colors.text, fontSize: font.md, fontWeight: '600' },
    // Full-width row, 48dp tall: the whole row is the target, not just its label.
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(1.5), minHeight: 48 },
    backdrop: { flex: 1, justifyContent: 'center', padding: spacing(2), backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { backgroundColor: colors.card ?? colors.background, borderRadius: 16, padding: spacing(2), gap: spacing(1) },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  });
