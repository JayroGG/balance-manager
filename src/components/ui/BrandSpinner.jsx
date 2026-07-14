import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

// Brand loader: the logo ring (blue = available, green arc = allocated) spinning.
// Pure RN Animated — no svg/lottie dep, Expo Go safe.
export const BrandSpinner = ({ size = 36 }) => {
  const { colors } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(3, size / 9),
        borderColor: colors.primary,
        borderTopColor: colors.success,
        transform: [{ rotate }],
      }}
    />
  );
};
