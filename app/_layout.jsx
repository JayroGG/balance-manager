import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { store, persistor } from '../src/store';
import { hydrateAuth } from '../src/reducers/auth';
import { getToken } from '../src/services/storage/secure';
import { decodeUser } from '../src/utils/jwt';
import { useTheme } from '../src/hooks/useTheme';
import { initI18n } from '../src/i18n';

// Keep the splash up until the cold-start bootstrap finishes (ADR-001/006/007).
SplashScreen.preventAutoHideAsync();

function Bootstrap({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initI18n();
        const token = await getToken(); // null in bypass mode → selectToken serves a placeholder
        store.dispatch(hydrateAuth({ token, user: decodeUser(token) }));
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (!ready) return null;
  return children;
}

// Status-bar icons follow the active scheme (must live inside the Redux Provider — useTheme reads it).
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <ThemedStatusBar />
          <Bootstrap>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </Bootstrap>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}
