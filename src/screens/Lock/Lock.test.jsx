jest.mock('../../components/ui/SortableList', () => ({ SortableList: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), Redirect: () => null }));
const mockAuthenticate = jest.fn();
jest.mock('../../hooks/useAppLock', () => ({
  useAppLock: () => ({ authenticate: mockAuthenticate, busy: false, error: null }),
}));
jest.mock('../../services/api/hardLogout', () => ({ hardLogout: jest.fn(async () => {}) }));

import { renderWithStore as render } from '../../test-utils/renderWithStore';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { hardLogout } from '../../services/api/hardLogout';
import Lock from './index';

beforeEach(() => mockAuthenticate.mockClear());

describe('Lock screen', () => {
  it('opens the prompt on mount and again on Try again', () => {
    render(<Lock />);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('auth.tryAgain'));
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });

  it('Use password logs out and unlocks into the form', async () => {
    const { store } = render(<Lock />);
    fireEvent.press(screen.getByText('auth.usePassword'));
    await waitFor(() => expect(store.getState().lock.passwordOnly).toBe(true));
    expect(hardLogout).toHaveBeenCalled();
    expect(store.getState().lock.locked).toBe(false);
  });
});
