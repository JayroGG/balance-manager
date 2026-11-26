jest.mock('../../components/ui/SortableList', () => ({ SortableList: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false, ENV: 'test' } }));
jest.mock('../../services/api/balance', () => ({ useGetBalanceQuery: () => ({ data: { currency: 'MXN' } }) }));
jest.mock('../../store', () => ({ persistor: { purge: jest.fn() } }));
const mockClear = jest.fn(async () => {});
const mockSave = jest.fn(async () => {});
const mockOptOut = jest.fn(async () => {});
jest.mock('../../services/storage/biometric', () => ({
  clearStoredCreds: () => mockClear(),
  saveStoredCreds: (c) => mockSave(c),
  setOptOut: (v) => mockOptOut(v),
  canUseBiometrics: jest.fn(async () => true),
  promptBiometric: jest.fn(async () => ({ success: true, error: null })),
}));

import { Switch } from 'react-native';
import { renderWithStore as render } from '../../test-utils/renderWithStore';
import { fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { setLockEnabled } from '../../reducers/lock';
import Settings from './index';

beforeEach(() => {
  global.fetch.mockReset();
  mockClear.mockClear(); mockSave.mockClear(); mockOptOut.mockClear();
});

describe('Settings fingerprint toggle', () => {
  it('OFF deletes creds, records opt-out and disables the lock', async () => {
    const { store, UNSAFE_getByType } = render(<Settings />);
    act(() => { store.dispatch(setLockEnabled(true)); });
    await act(async () => { await UNSAFE_getByType(Switch).props.onValueChange(false); });
    expect(mockOptOut).toHaveBeenCalledWith(true);
    expect(mockClear).toHaveBeenCalled();
    expect(store.getState().lock.enabled).toBe(false);
  });

  it('ON asks for credentials, verifies them, saves and clears the opt-out', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ token: 'a.b.c' }), {
        status: 200, headers: { 'content-type': 'application/json' } })));
    const { store, UNSAFE_getByType } = render(<Settings />);
    await act(async () => { await UNSAFE_getByType(Switch).props.onValueChange(true); });
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(inputs[0], 'a@b.c');
    fireEvent.changeText(inputs[1], 'pw');
    fireEvent.press(screen.getByText('auth.unlock'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }));
    expect(mockOptOut).toHaveBeenCalledWith(false);
    expect(store.getState().lock.enabled).toBe(true);
  });
});
