import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, font, radius, spacing } from './theme';
import { formatMoney } from '../utils/money';

export const Screen = ({ children, scroll = false, refreshControl, padded = true, style }) => {
  const insets = useSafeAreaInsets();
  const base = [
    { flex: 1, backgroundColor: colors.bg, paddingTop: insets.top },
    padded && { paddingHorizontal: spacing(2) },
    style,
  ];
  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          { paddingTop: insets.top, paddingBottom: spacing(4) },
          padded && { paddingHorizontal: spacing(2) },
        ]}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={base}>{children}</View>;
};

export const Card = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

export const SectionTitle = ({ children }) => <Text style={styles.section}>{children}</Text>;

export const Muted = ({ children, style }) => <Text style={[styles.muted, style]}>{children}</Text>;

export const MoneyText = ({ amount, currency, style }) => (
  <Text style={style}>{formatMoney(amount, currency)}</Text>
);

export const AppButton = ({ title, onPress, variant = 'primary', disabled, loading, style }) => {
  const tint =
    variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.primary;
  const txt = variant === 'ghost' ? colors.primary : colors.primaryText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tint, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.primary },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={txt} /> : <Text style={[styles.buttonText, { color: txt }]}>{title}</Text>}
    </Pressable>
  );
};

export const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: spacing(2) }}>
    {!!label && <Text style={styles.label}>{label}</Text>}
    <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
  </View>
);

export const Chip = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
  >
    <Text style={[styles.chipText, active && { color: colors.primaryText }]}>{label}</Text>
  </Pressable>
);

export const EmptyState = ({ text }) => (
  <View style={styles.centered}>
    <Muted>{text}</Muted>
  </View>
);

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
        <Text style={{ color: colors.danger, marginBottom: spacing(1.5), textAlign: 'center' }}>
          {error.message || t('common.error')}
        </Text>
        {!!onRetry && <AppButton title={t('common.retry')} onPress={onRetry} variant="ghost" />}
      </View>
    );
  }
  if (isEmpty) return <EmptyState text={emptyText} />;
  return children;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  section: { fontSize: font.sm, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginVertical: spacing(1.5) },
  muted: { color: colors.muted, fontSize: font.md },
  button: { borderRadius: radius.md, paddingVertical: spacing(1.75), alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '700', fontSize: font.md },
  label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.5),
    fontSize: font.md,
    color: colors.text,
  },
  chip: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  chipText: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
});
