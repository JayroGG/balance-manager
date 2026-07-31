import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius as radiusTokens } from '../theme';

// Shimmer placeholder that occupies fixed geometry — for known-shape layouts (hero figures, vault rows,
// totals bars) where a variable-length list would use BrandSpinner instead (ADR-019: a skeleton cannot
// honestly predict a row count). Pure RN Animated, no svg/lottie dep, Expo Go safe — mirrors BrandSpinner.
export const Skeleton = ({ width = '100%', height = 16, radius: r = radiusTokens.sm, style }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: colors.border,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};
