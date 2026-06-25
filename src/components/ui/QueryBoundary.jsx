import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../theme';
import { AppButton } from './Button';
import { EmptyState } from './EmptyState';

// Wraps query results: spinner while first-loading, error + retry, empty state, else children.
export const QueryBoundary = ({ isLoading, error, isEmpty, onRetry, emptyText, children }) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error.message || t('common.error')}</Text>
        {!!onRetry && <AppButton title={t('common.retry')} onPress={onRetry} variant="ghost" />}
      </View>
    );
  }
  if (isEmpty) return <EmptyState text={emptyText} />;
  return children;
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  error: { color: colors.danger, marginBottom: spacing(1.5), textAlign: 'center' },
});
