import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

// Opaque full-screen cover shown while the app is in the background / app switcher (nothing of the account).
export function PrivacyCover() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View testID="privacy-cover" style={[styles.cover, { backgroundColor: colors.bg }]} pointerEvents="auto">
      <Text style={[styles.name, { color: colors.text }]}>{t('common.appName')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 28, fontWeight: '800' },
});
