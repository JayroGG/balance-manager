// Env flows: .env.${APP_ENV} -> dotenv -> expo `extra` -> expo-constants -> src/utils/config.js
// (managed workflow; we do NOT use react-native-config — see .claude/ADR/ADR-003)
const path = require('path');

const APP_ENV = process.env.APP_ENV || 'dev';
require('dotenv').config({ path: path.resolve(__dirname, `.env.${APP_ENV}`) });

module.exports = () => ({
  expo: {
    name: 'balance-mobile',
    slug: 'balance-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'balancemobile',
    userInterfaceStyle: 'automatic',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.jayro.balancemobile',
    },
    android: {
      package: 'com.jayro.balancemobile',
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: '#0F172A',
      },
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-localization',
      './plugins/withAndroidReleaseSigning',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F7F8FA',
          dark: {
            image: './assets/splash-icon-dark.png',
            backgroundColor: '#0F1115',
          },
        },
      ],
    ],
    experiments: { reactCompiler: true },
    extra: {
      apiUrl: process.env.API_URL,
      authBypass: process.env.AUTH_BYPASS === 'true',
      env: APP_ENV,
    },
  },
});
