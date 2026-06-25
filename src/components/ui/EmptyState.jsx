import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Muted } from './Typography';

export const EmptyState = ({ text }) => (
  <View style={styles.centered}>
    <Muted>{text}</Muted>
  </View>
);

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
});
