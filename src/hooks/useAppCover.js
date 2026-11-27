import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isBiometricPrompting } from '../services/storage/biometric';

// True while the app is not 'active' (an in-app Face ID sheet also makes iOS 'inactive': that is ignored) (iOS: inactive -> the app-switcher snapshot is taken then; Android: background).
// The root renders an opaque cover over everything while this is true, so the OS snapshot never shows balances.
export function useAppCover() {
  const [covered, setCovered] = useState(AppState.currentState === 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setCovered(next === 'background' || (next === 'inactive' && !isBiometricPrompting())));
    return () => sub.remove();
  }, []);
  return covered;
}
