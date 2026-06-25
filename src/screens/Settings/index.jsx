import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGetBalanceQuery } from '../../services/api/balance';
import { persistor } from '../../store';
import { Config } from '../../utils/config';
import { LANGUAGES, changeLanguage } from '../../i18n';
import { Screen, Card, Chip, AppButton, SectionTitle } from '../../components/ui';
import { colors, font, spacing } from '../../components/theme';

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { data } = useGetBalanceQuery();

  const onClearCache = async () => {
    await persistor.purge();
    Alert.alert(t('settings.clearCache'), '✓');
  };

  return (
    <Screen scroll>
      <Text style={styles.h1}>{t('settings.title')}</Text>

      <Card>
        <Row label={t('settings.currency')} value={data?.currency ?? '—'} />
        <Row label={t('settings.environment')} value={Config.ENV} />
        <Row label={t('settings.auth')} value={t('settings.authBypassed')} />
      </Card>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <View style={styles.langRow}>
        {LANGUAGES.map((l) => (
          <Chip key={l.key} label={l.label} active={i18n.language === l.key} onPress={() => changeLanguage(l.key)} />
        ))}
      </View>

      <AppButton title={t('settings.clearCache')} variant="ghost" onPress={onClearCache} style={{ marginTop: spacing(2) }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginVertical: spacing(1.5) },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing(0.75) },
  label: { color: colors.muted, fontSize: font.md },
  value: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
