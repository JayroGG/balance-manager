import { AppState } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from '../reducers/auth';
import lockReducer from '../reducers/lock';
import { useAppLockWatcher, LOCK_AFTER_MS } from './useAppLockWatcher';

let listener;
let now;
beforeEach(() => {
  listener = null;
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => {
    listener = cb;
    return { remove: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

const setup = ({ token, enabled }) => {
  const store = configureStore({
    reducer: combineReducers({ auth: authReducer, lock: lockReducer }),
    preloadedState: {
      auth: { token, user: null, bypass: false, bootstrapped: true },
      lock: { enabled, locked: false, passwordOnly: false, rejected: false },
    },
  });
  renderHook(() => useAppLockWatcher(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
  return store;
};
const background = (ms) => {
  listener('background');
  now += ms;
  listener('active');
};

it('resume after the grace window locks a session even with biometrics off (mandatory lock)', () => {
  const store = setup({ token: 'tok', enabled: false });
  background(LOCK_AFTER_MS + 1);
  expect(store.getState().lock.locked).toBe(true);
});

it('a quick return within the grace window does not lock', () => {
  const store = setup({ token: 'tok', enabled: true });
  background(LOCK_AFTER_MS - 1000);
  expect(store.getState().lock.locked).toBe(false);
});

it('no session and no biometric creds: nothing to lock (Login is showing)', () => {
  const store = setup({ token: null, enabled: false });
  background(LOCK_AFTER_MS + 1);
  expect(store.getState().lock.locked).toBe(false);
});

it('dev AUTH_BYPASS (placeholder token, no real session) never locks: there would be no way to unlock', () => {
  const store = configureStore({
    reducer: combineReducers({ auth: authReducer, lock: lockReducer }),
    preloadedState: {
      auth: { token: null, user: null, bypass: true, bootstrapped: true },
      lock: { enabled: false, locked: false, passwordOnly: false, rejected: false },
    },
  });
  renderHook(() => useAppLockWatcher(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
  listener('background');
  now += LOCK_AFTER_MS + 1;
  listener('active');
  expect(store.getState().lock.locked).toBe(false);
});
