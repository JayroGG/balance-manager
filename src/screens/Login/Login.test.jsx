jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { renderWithStore as render, fireEvent, screen } from '../../test-utils/renderWithStore';
import Login from './index';

describe('Login password field', () => {
  it('disables auto-capitalize/correct and starts hidden', () => {
    render(<Login />);
    const input = screen.getByPlaceholderText('••••••••');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('toggle flips secureTextEntry, label and keeps the typed value', () => {
    render(<Login />);
    const input = screen.getByPlaceholderText('••••••••');
    fireEvent.changeText(input, 'Secret1');
    fireEvent.press(screen.getByLabelText('auth.showPassword'));
    expect(screen.getByPlaceholderText('••••••••').props.secureTextEntry).toBe(false);
    expect(screen.getByPlaceholderText('••••••••').props.value).toBe('Secret1');
    expect(screen.getByLabelText('auth.hidePassword')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('auth.hidePassword'));
    expect(screen.getByPlaceholderText('••••••••').props.secureTextEntry).toBe(true);
  });
});
