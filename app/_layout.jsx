import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { store, persistor } from '../src/store';
import { useTheme } from '../src/hooks/useTheme';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
import { useAppLockWatcher } from '../src/hooks/useAppLockWatcher';
import { LockGate } from '../src/components/LockGate';
import { bootstrapState } from '../src/services/bootstrap';

// Keep the native splash up until the cold-start bootstrap finishes (ADR-001/006/007);
// AnimatedSplash then hides it behind an identical frame and animates the handoff (ADR-016).
SplashScreen.preventAutoHideAsync();

function Bootstrap({ children }) {
  const [ready, setReady] = useState(false);
  const [handoff, setHandoff] = useState(true);
  useAppLockWatcher();

  useEffect(() => {
    bootstrapState(store)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null; // native splash still covering
  return (
    <>
      <LockGate>{children}</LockGate>
      {handoff && <AnimatedSplash onDone={() => setHandoff(false)} />}
    </>
  );
}

// Status-bar icons follow the active scheme (must live inside the Redux Provider — useTheme reads it).
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
