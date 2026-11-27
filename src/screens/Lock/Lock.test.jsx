jest.mock('../../components/ui/SortableList', () => ({ SortableList: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), Redirect: () => null }));
const mockSecure = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k) => mockSecure[k] ?? null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockAuthenticate = jest.fn();
jest.mock('../../hooks/useAppLock', () => ({
  useAppLock: () => ({ authenticate: mockAuthenticate, busy: false, error: null }),
}));
jest.mock('../../services/api/hardLogout', () => ({ hardLogout: jest.fn(async () => {}) }));

import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { baseApi } from '../../services/api/baseApi';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import prefsReducer from '../../reducers/prefs';
import lockReducer from '../../reducers/lock';
import { hardLogout } from '../../services/api/hardLogout';
import Lock from './index';

const makeStore = ({ authed, biometric }) =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      prefs: prefsReducer,
      lock: lockReducer,
    }),
    preloadedState: {
      auth: {
        token: authed ? 'tok' : null,
        user: authed ? { id: 7, email: 'me@example.com' } : null,
        bypass: false,
        bootstrapped: true,
      },
      lock: { enabled: biometric, locked: true, passwordOnly: false, rejected: false },
    },
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });

const renderLock = (opts) => {
  const store = makeStore(opts);
  return { store, ...render(<Provider store={store}><Lock /></Provider>) };
};

const reply = (status, body = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  mockAuthenticate.mockClear();
  hardLogout.mockClear();
  global.fetch.mockReset();
  Object.keys(mockSecure).forEach((k) => delete mockSecure[k]);
});

// step-up answers 401 -> the shared refresh runs -> the verdict depends on how the refresh went

describe('Lock screen: biometrics on', () => {
  it('opens the prompt on mount and again on Try again', () => {
    renderLock({ authed: true, biometric: true });
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('auth.tryAgain'));
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });

  it('Use password (with a session) switches to the password form in place, no logout', () => {
    const { store } = renderLock({ authed: true, biometric: true });
    fireEvent.press(screen.getByText('auth.usePassword'));
    expect(screen.getByTestId('lock-password')).toBeTruthy();
    expect(hardLogout).not.toHaveBeenCalled();
    expect(store.getState().lock.locked).toBe(true);
  });

  it('without a session, Use password logs out and unlocks into the Login form', async () => {
    const { store } = renderLock({ authed: false, biometric: true });
    fireEvent.press(screen.getByText('auth.usePassword'));
    await waitFor(() => expect(store.getState().lock.passwordOnly).toBe(true));
    expect(hardLogout).toHaveBeenCalled();
    expect(store.getState().lock.locked).toBe(false);
  });
});

describe('Lock screen: password unlock (biometrics off or not enrolled)', () => {
  it('goes straight to the password form with the email read-only, and never opens the biometric prompt', () => {
    renderLock({ authed: true, biometric: false });
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('me@example.com').props.editable).toBe(false);
    expect(screen.getByTestId('lock-password')).toBeTruthy();
  });

  it('a correct password is verified by the backend (/auth/step-up) and unlocks, with no new session', async () => {
    global.fetch.mockImplementation(() => reply(200, { permit: 'p' }));
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.changeText(screen.getByTestId('lock-password'), 'secret');
    fireEvent.press(screen.getByText('auth.unlock'));
    await waitFor(() => expect(store.getState().lock.locked).toBe(false));
    const [url] = global.fetch.mock.calls[0];
    expect(String(url?.url ?? url)).toContain('/auth/step-up');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(store.getState().api)).not.toContain('secret'); // password never reaches redux state
  });

  it('a wrong password (refresh ok, retry still 401) shows an inline error and stays locked', async () => {
    mockSecure.auth_refresh_token = 'r1';
    global.fetch.mockImplementation((req) =>
      String(req?.url ?? req).includes('/auth/refresh')
        ? reply(200, { token: 'tok2', refreshToken: 'r2' })
        : reply(401, { error: 'bad' }));
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.changeText(screen.getByTestId('lock-password'), 'nope');
    fireEvent.press(screen.getByText('auth.unlock'));
    expect(await screen.findByText('auth.invalidCredentials')).toBeTruthy();
    expect(screen.getByTestId('lock-error').props.accessibilityRole).toBe('alert');
    expect(store.getState().lock.locked).toBe(true);
    expect(hardLogout).not.toHaveBeenCalled(); // a wrong password is never a logout
  });

  it('a DEAD session (no/rejected refresh token) is not reported as a wrong password: it ends and goes to Login', async () => {
    mockSecure.auth_refresh_token = 'r1';
    global.fetch.mockImplementation((req) =>
      String(req?.url ?? req).includes('/auth/refresh') ? reply(401, { error: 'revoked' }) : reply(401, { error: 'expired' }));
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.changeText(screen.getByTestId('lock-password'), 'right-password');
    fireEvent.press(screen.getByText('auth.unlock'));
    await waitFor(() => expect(hardLogout).toHaveBeenCalled());
    await waitFor(() => expect(store.getState().lock.passwordOnly).toBe(true));
    expect(screen.queryByText('auth.invalidCredentials')).toBeNull();
  });

  it('a transient refresh failure (5xx) shows the network retry, not a wrong password', async () => {
    mockSecure.auth_refresh_token = 'r1';
    global.fetch.mockImplementation((req) =>
      String(req?.url ?? req).includes('/auth/refresh') ? reply(503, {}) : reply(401, { error: 'expired' }));
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.changeText(screen.getByTestId('lock-password'), 'right-password');
    fireEvent.press(screen.getByText('auth.unlock'));
    expect(await screen.findByText('auth.networkError')).toBeTruthy();
    expect(screen.queryByText('auth.invalidCredentials')).toBeNull();
    expect(store.getState().lock.locked).toBe(true);
    expect(hardLogout).not.toHaveBeenCalled();
  });

  it('a network failure shows a retry and stays locked; retry can then unlock', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.changeText(screen.getByTestId('lock-password'), 'secret');
    fireEvent.press(screen.getByText('auth.unlock'));
    expect(await screen.findByText('auth.networkError')).toBeTruthy();
    expect(store.getState().lock.locked).toBe(true);
    global.fetch.mockReset().mockImplementation(() => reply(200, { permit: 'p' }));
    fireEvent.press(screen.getByText('common.retry'));
    await waitFor(() => expect(store.getState().lock.locked).toBe(false));
  });

  it('the unlock button needs a password', () => {
    renderLock({ authed: true, biometric: false });
    fireEvent.press(screen.getByText('auth.unlock'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Log out is available, ends the session and leaves the lock for the Login form', async () => {
    const { store } = renderLock({ authed: true, biometric: false });
    fireEvent.press(screen.getByText('auth.logout'));
    await waitFor(() => expect(hardLogout).toHaveBeenCalled());
    await waitFor(() => expect(store.getState().lock.locked).toBe(false));
    expect(store.getState().lock.passwordOnly).toBe(true);
  });
});
