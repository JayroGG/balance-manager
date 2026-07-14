import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// Keyboard: every screen avoids it through this single wrapper — iOS needs 'padding' (the window
// never resizes); Android resizes the window itself (adjustResize), so no behavior there.
const kavBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

export const Screen = ({ children, scroll = false, refreshControl, padded = true, style }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={kavBehavior}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingTop: insets.top, paddingBottom: spacing(4) },
            padded && { paddingHorizontal: spacing(2) },
          ]}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            { flex: 1, paddingTop: insets.top },
            padded && { paddingHorizontal: spacing(2) },
            style,
          ]}
        >
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};
