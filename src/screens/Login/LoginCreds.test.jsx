jest.mock('../../components/ui/SortableList', () => ({ SortableList: () => null }));
jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));
const mockAuth = jest.fn();
const mockSave = jest.fn();
const mockOptedOut = jest.fn();
const mockFlag = jest.fn(async () => false);
jest.mock('../../services/storage/biometric', () => ({
  saveStoredCreds: (...a) => mockSave(...a),
  isOptedOut: () => mockOptedOut(),
  isBiometricEnabled: (...a) => mockFlag(...a),
  canUseBiometrics: jest.fn(async () => true),
}));
jest.mock('../../services/api/session', () => ({ saveSession: jest.fn(async () => {}) }));
jest.mock('../../hooks/useAppLock', () => ({
  useAppLock: () => ({ authenticate: (...a) => mockAuth(...a), busy: false, error: null }),
}));

import { renderWithStore as render } from '../../test-utils/renderWithStore';
import { fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { saveSession } from '../../services/api/session';
import { setLockEnabled, usePasswordInstead } from '../../reducers/lock';
import Login from './index';

const ok = () =>
  global.fetch.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ token: 'a.b.c', refreshToken: 'r' }), {
      status: 200, headers: { 'content-type': 'application/json' } })));

const submit = () => {
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@b.c');
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'pw');
  fireEvent.press(screen.getByText('auth.signIn'));
};

beforeEach(() => {
  global.fetch.mockReset();
  mockSave.mockReset().mockResolvedValue();
  mockOptedOut.mockReset().mockResolvedValue(false);
  saveSession.mockClear();
  ok();
});

describe('Login boot-state recovery', () => {
  it('flag in SecureStore but lock.enabled=false in state -> button appears + auto prompt', async () => {
    mockFlag.mockResolvedValueOnce(true);
    const { store } = render(<Login />);
    await waitFor(() => expect(store.getState().lock.enabled).toBe(true));
    expect(screen.getByText('auth.useBiometric')).toBeTruthy();
    expect(mockAuth).toHaveBeenCalled();
  });
});

describe('Login biometric button', () => {
  it('stays visible when enabled && passwordOnly and tapping it clears passwordOnly + authenticates', () => {
    const { store } = render(<Login />);
    expect(screen.queryByText('auth.useBiometric')).toBeNull();
    act(() => {
      store.dispatch(setLockEnabled(true));
      store.dispatch(usePasswordInstead());
    });
    expect(store.getState().lock.passwordOnly).toBe(true);
    fireEvent.press(screen.getByText('auth.useBiometric'));
    expect(store.getState().lock.passwordOnly).toBe(false);
    expect(mockAuth).toHaveBeenCalled();
  });
});

describe('Login stored credentials', () => {
  it('saves creds after a password login and enables the lock', async () => {
    const { store } = render(<Login />);
    submit();
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }));
    expect(store.getState().lock.enabled).toBe(true);
  });

  it('a save failure does not block login', async () => {
    mockSave.mockRejectedValue(new Error('keychain'));
    render(<Login />);
    submit();
    await waitFor(() => expect(saveSession).toHaveBeenCalled());
  });

  it('respects the opt-out', async () => {
    mockOptedOut.mockResolvedValue(true);
    const { store } = render(<Login />);
    submit();
    await waitFor(() => expect(saveSession).toHaveBeenCalled());
    expect(mockSave).not.toHaveBeenCalled();
    expect(store.getState().lock.enabled).toBe(false);
  });
});
