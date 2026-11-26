jest.mock('../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => {
  const m = {};
  const get = async (k) => m[k] ?? null;
  return {
    __get: get,
    getItemAsync: jest.fn(get),
    setItemAsync: jest.fn(async (k, v) => { m[k] = v; }),
    deleteItemAsync: jest.fn(async (k) => { delete m[k]; }),
  };
});

import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import * as LA from 'expo-local-authentication';
import { baseApi } from '../services/api/baseApi';
import authReducer, { hydrateAuth } from '../reducers/auth';
import lockReducer, { initLock, lockApp } from '../reducers/lock';
import { useAppLock } from './useAppLock';
import { shouldLockOnResume, LOCK_AFTER_MS } from './useAppLockWatcher';
import * as bio from '../services/storage/biometric';
import { hardLogout } from '../services/api/hardLogout';

const makeStore = () =>
  configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, lock: lockReducer,
      context: (s = {}) => s, activity: (s = {}) => s }),
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });

const setup = (store) =>
  renderHook(() => useAppLock(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });

beforeEach(() => {
  global.fetch.mockReset();
  const SecureStore = require('expo-secure-store');
  SecureStore.getItemAsync.mockImplementation(SecureStore.__get);
  SecureStore.deleteItemAsync.mockClear();
  LA.authenticateAsync.mockReset();
  LA.authenticateAsync.mockResolvedValue({ success: true });
});

describe('lock timing', () => {
  it('locks only after more than 5 minutes in background', () => {
    expect(shouldLockOnResume(0, LOCK_AFTER_MS + 1)).toBe(true);
    expect(shouldLockOnResume(0, LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldLockOnResume(null, 10 ** 9)).toBe(false);
  });
});

describe('lock slice', () => {
  it('cold start locks only when creds are stored; lockApp is a no-op when disabled', () => {
    const s = makeStore();
    s.dispatch(lockApp());
    expect(s.getState().lock.locked).toBe(false);
    s.dispatch(initLock(true));
    expect(s.getState().lock.locked).toBe(true);
  });
});

describe('useAppLock', () => {
  it('logged in: unlocks with no network', async () => {
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: 'a.b.c', user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('unlocked');
    expect(s.getState().lock.locked).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cancelled prompt stays locked', async () => {
    LA.authenticateAsync.mockResolvedValue({ success: false });
    const s = makeStore();
    s.dispatch(initLock(true));
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('cancelled');
    expect(s.getState().lock.locked).toBe(true);
  });

  it('rejected stored creds are deleted and flagged', async () => {
    await bio.saveStoredCreds({ email: 'a@b.c', password: 'old' });
    global.fetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'bad' }), { status: 401, headers: { 'content-type': 'application/json' } })));
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: null, user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('rejected');
    expect(await bio.getStoredCreds()).toBeNull();
    expect(await bio.isBiometricEnabled()).toBe(false);
    expect(s.getState().lock).toMatchObject({ enabled: false, locked: false, rejected: true });
  });
});

describe('resume / keychain edge cases', () => {
  it('interrupted prompt (system_cancel) retries once -> unlocked, session intact, creds kept', async () => {
    await bio.saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    LA.authenticateAsync
      .mockResolvedValueOnce({ success: false, error: 'system_cancel' })
      .mockResolvedValueOnce({ success: true });
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: 'a.b.c', user: null }));
    s.dispatch(initLock(true));
    s.dispatch(lockApp());
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('unlocked');
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(2);
    expect(s.getState().auth.token).toBe('a.b.c');
    expect(s.getState().lock.locked).toBe(false);
    expect(await bio.getStoredCreds()).toEqual({ email: 'a@b.c', password: 'pw' });
  });

  it('a user cancel is NOT retried', async () => {
    LA.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    const s = makeStore();
    s.dispatch(initLock(true));
    const { result } = setup(s);
    await act(async () => { await result.current.authenticate(); });
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('unreadable keychain (null creds, flag unreadable) keeps flag and creds state', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValue(null); // locked device: every read is null
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: null, user: null }));
    s.dispatch(initLock(true));
    SecureStore.deleteItemAsync.mockClear();
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('error');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(s.getState().lock.enabled).toBe(true);
  });

  it('flag readable but creds gone is confirmed-missing -> cleared', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockImplementation(async (k) => (k === 'bio_enabled' ? '1' : null));
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: null, user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('rejected');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('bio_enabled');
  });
});

describe('prompt gating', () => {
  const { AppState } = require('react-native');
  const setState = (v) => Object.defineProperty(AppState, 'currentState', { value: v, configurable: true });
  afterEach(() => setState('active'));

  it('single-flight: concurrent authenticate calls share one prompt', async () => {
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: 'a.b.c', user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    await act(async () => { await Promise.all([result.current.authenticate(), result.current.authenticate()]); });
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('inactive app: proceeds anyway after the timeout', async () => {
    setState('inactive');
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: 'a.b.c', user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    let r;
    await act(async () => { r = await result.current.authenticate(); });
    expect(r).toBe('unlocked');
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('unmount cancels a pending wait: no stale prompt', async () => {
    setState('inactive');
    const s = makeStore();
    s.dispatch(initLock(true));
    const { result, unmount } = setup(s);
    let p;
    act(() => { p = result.current.authenticate(); });
    unmount();
    await act(async () => { expect(await p).toBe('cancelled'); });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('flag + creds reads', () => {
  it('isBiometricEnabled fails closed on a throwing read when asked', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockRejectedValue(new Error('locked'));
    expect(await bio.isBiometricEnabled(true)).toBe(true);
    expect(await bio.isBiometricEnabled()).toBe(false);
  });

  it('unavailable keychain shows the neutral message', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValue(null);
    const s = makeStore();
    s.dispatch(hydrateAuth({ token: null, user: null }));
    s.dispatch(initLock(true));
    const { result } = setup(s);
    await act(async () => { await result.current.authenticate(); });
    expect(result.current.error).toBe('auth.unlockFailed');
  });

  it('missing creds are re-read once before clearing (late-appearing creds survive)', async () => {
    const SecureStore = require('expo-secure-store');
    let n = 0;
    SecureStore.getItemAsync.mockImplementation(async (k) => {
      if (k === 'bio_enabled') return '1';
      n += 1;
      return n <= 2 ? null : k === 'bio_email' ? 'a@b.c' : 'pw';
    });
    const r = await bio.readStoredCreds();
    expect(r.status).toBe('ok');
  });
});

describe('creds lifecycle', () => {
  it('hardLogout keeps stored creds; clearStoredCreds (toggle off) deletes them', async () => {
    await bio.saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    await hardLogout(makeStore().dispatch);
    expect(await bio.getStoredCreds()).toEqual({ email: 'a@b.c', password: 'pw' });
    await bio.clearStoredCreds();
    expect(await bio.getStoredCreds()).toBeNull();
  });
});
