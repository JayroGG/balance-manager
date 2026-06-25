import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed } from '../../src/reducers/auth';
import { Screen, AppButton } from '../../src/components/ui';
import { colors, font, spacing } from '../../src/components/theme';

// Placeholder login. In the prototype AUTH_BYPASS is on, so we never land here (Index redirects to
// tabs). This is where the Auth0 hosted-login button drops in for Phase 2 (ADR-001).
export default function Login() {
  const authed = useSelector(selectIsAuthed);
  const { t } = useTranslation();

  if (authed) return <Redirect href="/(tabs)/dashboard" />;

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('common.appName')}</Text>
        <Text style={styles.sub}>{t('settings.authBypassed')}</Text>
        <AppButton title="Continue" onPress={() => {}} disabled />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(2) },
  title: { fontSize: font.hero, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.md, color: colors.muted, marginBottom: spacing(2) },
});
