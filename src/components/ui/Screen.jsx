import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export const Screen = ({ children, scroll = false, refreshControl, padded = true, style }) => {
  const insets = useSafeAreaInsets();
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
  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg, paddingTop: insets.top },
        padded && { paddingHorizontal: spacing(2) },
        style,
      ]}
    >
      {children}
    </View>
  );
};
