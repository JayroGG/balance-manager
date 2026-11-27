import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useStore } from 'react-redux';
import { lockApp } from '../reducers/lock';

export const LOCK_AFTER_MS = 5 * 60 * 1000;

export const shouldLockOnResume = (backgroundedAt, now) =>
  backgroundedAt != null && now - backgroundedAt > LOCK_AFTER_MS;

// Locks the app when it returns to the foreground after more than 5 minutes in the background (the existing grace
// window), whenever a session exists or biometric creds are stored.
export function useAppLockWatcher() {
  const dispatch = useDispatch();
  const store = useStore();
  const bgAt = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        bgAt.current = Date.now();
      } else if (next === 'active') {
        const state = store.getState();
        if ((state.lock.enabled || !!state.auth.token) && shouldLockOnResume(bgAt.current, Date.now())) {
          dispatch(lockApp());
        }
        bgAt.current = null;
      }
    });
    return () => sub.remove();
  }, [dispatch, store]);
}
