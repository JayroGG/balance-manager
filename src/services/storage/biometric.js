import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

// Stored credentials for fingerprint unlock. Encrypted keychain/keystore only; hardLogout leaves them
// alone (logout keeps fingerprint login). Deleting them IS disabling the lock.
const EMAIL_KEY = 'bio_email';
const PASSWORD_KEY = 'bio_password';
const ENABLED_KEY = 'bio_enabled';
const OPTOUT_KEY = 'bio_optout'; // user turned fingerprint unlock off: password logins must not re-save creds
const SECURE = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// The flag shares the token's default accessibility on purpose: whenever the token is readable the flag is
// too, so a cold start can't see token-OK + flag-null and boot an unlocked session. If the read throws,
// `failClosed` (pass true when a token exists) keeps the lock on. The creds stay strict.
export const readBiometricFlag = async () => (await SecureStore.getItemAsync(ENABLED_KEY)) === '1';

export const isBiometricEnabled = async (failClosed = false) => {
  try {
    return await readBiometricFlag();
  } catch {
    return failClosed;
  }
};

export const getStoredCreds = async () => {
  const [email, password] = await Promise.all([
    SecureStore.getItemAsync(EMAIL_KEY),
    SecureStore.getItemAsync(PASSWORD_KEY),
  ]);
  return email && password ? { email, password } : null;
};

// Distinguishes "keychain unreadable" from "creds really gone". With WHEN_UNLOCKED_THIS_DEVICE_ONLY a
// locked device returns null/throws for every key, flag included — so only a flag we could READ as '1'
// next to missing creds is a confirmed absence. Anything else is 'unavailable' and must never clear state.
export const readStoredCreds = async () => {
  try {
    const read = async () => ({ flag: await isBiometricEnabled(), creds: await getStoredCreds() });
    let { flag, creds } = await read();
    if (creds) return { status: 'ok', creds };
    if (flag) {
      await new Promise((r) => setTimeout(r, 200)); // confirm before declaring the creds gone
      ({ flag, creds } = await read());
      if (creds) return { status: 'ok', creds };
    }
    return { status: flag ? 'missing' : 'unavailable', creds: null };
  } catch {
    return { status: 'unavailable', creds: null };
  }
};

export const saveStoredCreds = async ({ email, password }) => {
  await SecureStore.setItemAsync(EMAIL_KEY, email, SECURE);
  await SecureStore.setItemAsync(PASSWORD_KEY, password, SECURE);
  await SecureStore.setItemAsync(ENABLED_KEY, '1');
};

export const isOptedOut = async () => (await SecureStore.getItemAsync(OPTOUT_KEY)) === '1';
export const setOptOut = (v) =>
  v ? SecureStore.setItemAsync(OPTOUT_KEY, '1', SECURE) : SecureStore.deleteItemAsync(OPTOUT_KEY);

export const clearStoredCreds = async () => {
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await SecureStore.deleteItemAsync(ENABLED_KEY);
};

export const canUseBiometrics = async () =>
  (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());

// OS prompt; device PIN/pattern allowed as fallback. The app never sees biometric data.
export const promptBiometric = async (promptMessage) => {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
  });
  return { success: !!res.success, error: res.success ? null : (res.error ?? null) };
};
