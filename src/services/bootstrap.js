import { hydrateAuth } from '../reducers/auth';
import { initLock } from '../reducers/lock';
import { getToken } from './storage/secure';
import { readBiometricFlag } from './storage/biometric';
import { decodeUser } from '../utils/jwt';
import { initI18n } from '../i18n';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SecureStore can reject at cold start (keychain not ready, prewarm, locked device): retry a few times.
export const withRetry = async (fn, tries = 3, delay = 250) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      return { ok: true, value: await fn() };
    } catch {
      if (i < tries - 1) await sleep(delay);
    }
  }
  return { ok: false, value: null };
};

// Cold-start state, read defensively: nothing here may throw. If the flag can't be read the app fails
// CLOSED (locked, enabled) — the Lock screen re-reads token + creds itself on Try again — instead of
// booting an unlocked, logged-out Login with no fingerprint option. The lock is decided before the
// first render so nothing flashes behind it.
export const bootstrapState = async (store) => {
  try {
    await initI18n();
  } catch {
    // i18n failure must not abort the boot
  }
  const [tokenRes, flagRes] = await Promise.all([withRetry(getToken), withRetry(readBiometricFlag)]);
  const token = tokenRes.ok ? tokenRes.value : null;
  store.dispatch(hydrateAuth({ token, user: decodeUser(token) }));
  store.dispatch(initLock(flagRes.ok ? flagRes.value : true));
};
