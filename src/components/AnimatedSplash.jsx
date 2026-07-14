import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../hooks/useTheme';

// Splash→app handoff (ADR-016's deferred "Netflix-style" moment, Expo Go edition): the first
// frame reproduces the native splash exactly — same background, ring + glyph layers stacked at
// the logo's splash size — then the ring spins two revolutions, lands with a toon pop, and the
// whole overlay fades into the app. Pure RN Animated, no svg/lottie. Fetching/navigation run
// underneath: mount it on top of the app tree and unmount on `onDone`.

// The colors here deliberately bypass useTheme(): they must match the NATIVE splash frame
// (hardcoded in app.config.js), not the app theme. Expo Go only reads the top-level `splash`
// key — always the light background, image fit to screen width with the mark at 0.45 canvas
// scale — while dev builds use the plugin config (200pt image, 0.92 scale, dark variant).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const SPLASH_BG = { light: '#F7F8FA', dark: '#0F1115' };

const RING = require('../../assets/brand-ring.png');
const GLYPH = {
  light: require('../../assets/brand-glyph.png'), // navy glyph on the light splash
  dark: require('../../assets/brand-glyph-dark.png'),
};

export const AnimatedSplash = ({ onDone }) => {
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const variant = IS_EXPO_GO ? 'light' : scheme;
  // Layer canvases share splash-icon.png's geometry (mark at 0.92 scale), so this width puts the
  // mark at the exact size the native splash drew it.
  const size = IS_EXPO_GO ? width * (0.45 / 0.92) : 200;

  const turns = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim;
    let alive = true;
    (async () => {
      try {
        await SplashScreen.hideAsync(); // our first frame is already committed underneath
      } catch {} // already hidden / not shown (e.g. fast refresh)
      if (!alive) return;
      anim = Animated.sequence([
        Animated.timing(turns, {
          toValue: 2,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Toon landing: quick overshoot, springy settle.
        Animated.timing(pop, {
          toValue: 1.12,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(pop, { toValue: 1, bounciness: 14, speed: 24, useNativeDriver: true }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          delay: 60,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      anim.start(({ finished }) => finished && onDone());
    })();
    return () => {
      alive = false;
      anim?.stop();
    };
    // Mount-once: the sequence must not restart if the parent re-renders mid-animation.
  }, []);

  const rotate = turns.interpolate({ inputRange: [0, 2], outputRange: ['0deg', '720deg'] });

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      style={[styles.fill, { backgroundColor: SPLASH_BG[variant], opacity }]}
    >
      <Animated.View style={{ width: size, height: size, transform: [{ scale: pop }] }}>
        <Animated.Image
          source={RING}
          resizeMode="contain"
          style={[styles.layer, { transform: [{ rotate }] }]}
        />
        <Image source={GLYPH[variant]} resizeMode="contain" style={styles.layer} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Explicit edges — StyleSheet.absoluteFillObject was removed in RN 0.85 (spreading it is a
  // silent no-op). zIndex + elevation: react-native-screens gives native screens their own
  // elevation on Android, which would draw the first screen above a plain absolute sibling.
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
