import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// Keyboard: every screen avoids it through this single wrapper. 'padding' on BOTH platforms —
// iOS never resizes the window, and SDK 56 Android is always edge-to-edge, where the legacy
// adjustResize window mode no longer applies either.
const kavBehavior = 'padding';

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
