import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton, Field, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { font, radius, spacing } from '../../components/theme';

// Email + password re-auth prompt for transfers when biometrics are off/failed. Email is read-only context;
// only the password is sent (POST /auth/step-up {password}).
export default function StepUpModal({ visible, email, busy, error, onSubmit, onCancel }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('transfers.stepUpTitle')}</Text>
          <Muted style={styles.sub}>{t('transfers.stepUpBody')}</Muted>
          <Field label={t('auth.email')} value={email} editable={false} autoCapitalize="none" />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
          />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <AppButton
            title={t('transfers.confirm')}
            onPress={() => onSubmit(password)}
            disabled={busy || !password}
          />
          <AppButton title={t('common.cancel')} variant="ghost" onPress={onCancel} disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing(2) },
    sheet: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing(2), gap: spacing(1) },
    title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
    sub: { marginBottom: spacing(1) },
    err: { color: colors.danger, fontSize: font.sm },
  });
