jest.mock('../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));
jest.mock('../i18n', () => ({ initI18n: jest.fn(async () => {}) }));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(), isEnrolledAsync: jest.fn(), authenticateAsync: jest.fn(),
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
import * as SecureStore from 'expo-secure-store';
import { baseApi } from './api/baseApi';
import authReducer from '../reducers/auth';
import lockReducer from '../reducers/lock';
import { useAppLock } from '../hooks/useAppLock';
import { saveStoredCreds } from './storage/biometric';
import { setToken } from './storage/secure';
import { bootstrapState } from './bootstrap';

const TOKEN = 'h.eyJzdWIiOjd9.s'; // sub = 7

const makeStore = () =>
  configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, lock: lockReducer,
      context: (s = {}) => s, activity: (s = {}) => s }),
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });

const unlock = async (store) => {
  const { result } = renderHook(() => useAppLock(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  let r;
  await act(async () => { r = await result.current.authenticate(); });
  return r;
};

beforeEach(async () => {
  global.fetch.mockReset();
  SecureStore.getItemAsync.mockImplementation(SecureStore.__get);
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('bio_enabled');
  LA.authenticateAsync.mockReset().mockResolvedValue({ success: true });
});

describe('cold start', () => {
  it('(a) token + creds + flag -> locked, prompt success -> unlocked, still logged in', async () => {
    await setToken(TOKEN);
    await saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    const store = makeStore();
    await bootstrapState(store);
    expect(store.getState().lock).toMatchObject({ enabled: true, locked: true });
    expect(store.getState().auth.token).toBe(TOKEN);
    expect(await unlock(store)).toBe('unlocked');
    expect(store.getState().lock.locked).toBe(false);
    expect(store.getState().auth.token).toBe(TOKEN);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('(b) no token, creds + flag -> locked; success logs in with stored creds', async () => {
    await saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    global.fetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ token: TOKEN, refreshToken: 'r' }), {
        status: 200, headers: { 'content-type': 'application/json' } })));
    const store = makeStore();
    await bootstrapState(store);
    expect(store.getState().lock.locked).toBe(true);
    expect(await unlock(store)).toBe('unlocked');
    expect(store.getState().auth.token).toBe(TOKEN);
    expect(store.getState().lock.locked).toBe(false);
  });

  it('(c) reads throw twice then work -> retried, locked + correct', async () => {
    await setToken(TOKEN);
    await saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    let n = 0;
    SecureStore.getItemAsync.mockImplementation(async (k) => {
      n += 1;
      if (n <= 2) throw new Error('keychain not ready');
      return SecureStore.__get(k);
    });
    const store = makeStore();
    await bootstrapState(store);
    expect(store.getState().lock).toMatchObject({ enabled: true, locked: true });
    expect(store.getState().auth.token).toBe(TOKEN);
  });

  it('(d) reads always throw -> fail closed; Try again after the keychain recovers gets in', async () => {
    await setToken(TOKEN);
    await saveStoredCreds({ email: 'a@b.c', password: 'pw' });
    SecureStore.getItemAsync.mockRejectedValue(new Error('locked'));
    const store = makeStore();
    await bootstrapState(store);
    expect(store.getState().lock).toMatchObject({ enabled: true, locked: true });
    expect(store.getState().auth.token).toBeNull();
    SecureStore.getItemAsync.mockImplementation(SecureStore.__get); // keychain ready
    expect(await unlock(store)).toBe('unlocked');
    expect(store.getState().auth.token).toBe(TOKEN);
    expect(store.getState().lock.locked).toBe(false);
  });

  it('an i18n failure does not abort the boot', async () => {
    require('../i18n').initI18n.mockRejectedValueOnce(new Error('i18n'));
    const store = makeStore();
    await bootstrapState(store);
    expect(store.getState().auth.bootstrapped).toBe(true);
  });
});
