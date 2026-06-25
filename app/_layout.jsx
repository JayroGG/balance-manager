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
        store.dispatch(hydrateAuth({ token }));
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (!ready) return null;
  return children;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
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
