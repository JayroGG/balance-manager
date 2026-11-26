import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsAuthed, setToken, setUser } from '../reducers/auth';
import { decodeUser } from '../utils/jwt';
import { getToken } from '../services/storage/secure';
import { unlockApp, credsRejected } from '../reducers/lock';
import { useLoginMutation } from '../services/api/auth';
import { saveSession } from '../services/api/session';
import { readStoredCreds, clearStoredCreds, promptBiometric } from '../services/storage/biometric';

const INTERRUPTED = ['app_cancel', 'system_cancel'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ACTIVE_WAIT_MS = 1500;

// The OS cancels a prompt that opens while the app is still transitioning (inactive) — wait for 'active',
// but never longer than ACTIVE_WAIT_MS (proceed anyway). Returns { promise, cancel }; cancel removes the
// listener + timer so a stale wait can never prompt later (e.g. after "Use password").
const whenActive = () => {
  let cancel = () => {};
  const promise = new Promise((resolve) => {
    if (AppState.currentState !== 'inactive' && AppState.currentState !== 'background') {
      resolve(true);
      return;
    }
    let sub;
    const timer = setTimeout(() => done(true), ACTIVE_WAIT_MS);
    const done = (go) => {
      clearTimeout(timer);
      sub?.remove();
      resolve(go);
    };
    sub = AppState.addEventListener('change', (st) => st === 'active' && done(true));
    cancel = () => done(false);
  });
  return { promise, cancel };
};

// Open the OS prompt; on success unlock (logged in: instantly, no network) or log in with the stored
// credentials (logged out). Resolves 'unlocked' | 'cancelled' | 'rejected' | 'error'.
export function useAppLock() {
  const dispatch = useDispatch();
  const store = useStore();
  const { t } = useTranslation();
  const [login] = useLoginMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const inFlight = useRef(null);
  const cancelWait = useRef(() => {});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelWait.current();
    };
  }, []);

  const run = useCallback(async () => {
    setError(null);
    const ask = async () => {
      if (!alive.current) return { success: false, error: null };
      const wait = whenActive();
      cancelWait.current = wait.cancel;
      if (!(await wait.promise)) return { success: false, error: null };
      try {
        return await promptBiometric(t('auth.biometricPrompt'));
      } catch {
        return { success: false, error: null };
      }
    };
    let res = await ask();
    if (!res.success && INTERRUPTED.includes(res.error)) {
      await sleep(300); // interrupted by a transition, not by the user: one quiet retry
      res = await ask();
    }
    if (!res.success) return 'cancelled';
    if (selectIsAuthed(store.getState())) {
      dispatch(unlockApp());
      return 'unlocked';
    }
    setBusy(true);
    try {
      // Boot state may be stale (keychain wasn't ready at cold start): re-read the token ourselves.
      // An expired access token is fine — the first 401 goes through the refresh path in baseApi.
      const token = await getToken().catch(() => null);
      if (token) {
        dispatch(setToken(token));
        dispatch(setUser(decodeUser(token)));
        dispatch(unlockApp());
        return 'unlocked';
      }
      const { status, creds } = await readStoredCreds();
      if (!creds) {
        if (status === 'missing') {
          await clearStoredCreds(); // confirmed gone: drop the flag so cold start stops locking
          dispatch(credsRejected());
          return 'rejected';
        }
        // keychain unreadable (device locked): keep creds + flag, let the user retry
        setError(t('auth.unlockFailed'));
        return 'error';
      }
      const res = await login(creds).unwrap();
      await saveSession(res, dispatch);
      dispatch(unlockApp());
      return 'unlocked';
    } catch (err) {
      if (err?.status === 401) {
        await clearStoredCreds();
        dispatch(credsRejected());
        return 'rejected';
      }
      setError(err?.message ?? t('auth.invalidCredentials'));
      return 'error';
    } finally {
      setBusy(false);
    }
  }, [dispatch, store, login, t]);

  // Single-flight: a second call while one is pending shares it (Try again never stacks prompts).
  const authenticate = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = run().finally(() => {
        inFlight.current = null;
      });
    }
    return inFlight.current;
  }, [run]);

  return { authenticate, busy, error };
}
