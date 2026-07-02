import { Alert, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useLogoutMutation } from '../../services/api/auth';
import { baseApi } from '../../services/api/baseApi';
import { clearAuth } from '../../reducers/auth';
import { resetContext } from '../../reducers/context';
import { setThemeMode, selectThemeMode, THEME_MODES } from '../../reducers/prefs';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useTheme } from '../../hooks/useTheme';
import { clearToken } from '../../services/storage/secure';
import { persistor } from '../../store';
import { Config } from '../../utils/config';
import { LANGUAGES, changeLanguage } from '../../i18n';
import { Screen, ScreenHeader, Card, Chip, AppButton, SectionTitle } from '../../components/ui';
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
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const bypass = useSelector((s) => s.auth.bypass);
  const themeMode = useSelector(selectThemeMode);
  const teamId = useActiveTeamId();
  const { data } = useGetBalanceQuery(teamId);
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();

  const onClearCache = async () => {
    await persistor.purge();
    Alert.alert(t('settings.clearCache'), '✓');
  };

  // Real logout: best-effort revoke, then drop the token (slice + secure-store), reset context, and
  // purge cached financial data. The tabs guard then redirects to login. (ADR-011)
  // themeMode is a device pref, not session data — deliberately NOT reset here (ADR-013).
  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // server-side revoke is best-effort; clear locally regardless
    }
    await clearToken();
    dispatch(clearAuth());
    dispatch(resetContext());
    dispatch(baseApi.util.resetApiState());
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} />

      <Card>
        <Row label={t('settings.currency')} value={data?.currency ?? '—'} />
        <Row label={t('settings.environment')} value={Config.ENV} />
        {bypass ? <Row label={t('settings.auth')} value={t('settings.authBypassed')} /> : null}
      </Card>

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
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  });
