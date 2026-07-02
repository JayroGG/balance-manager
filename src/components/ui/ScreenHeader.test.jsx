const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
// Icons are visual-only here; the icon-font loader chain (expo-font → expo-asset) isn't installed.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import { Text } from 'react-native';
import { ScreenHeader } from './ScreenHeader';

// Behaviour-only: title renders, back navigates, the right slot renders.
describe('ScreenHeader', () => {
  beforeEach(() => mockBack.mockClear());

  it('renders its title', () => {
    renderWithStore(<ScreenHeader title="Transactions" />);
    expect(screen.getByText('Transactions')).toBeTruthy();
  });

  it('shows no back control by default', () => {
    renderWithStore(<ScreenHeader title="Dashboard" />);
    expect(screen.queryByTestId('header-back')).toBeNull();
  });

  it('back chevron pops the router', () => {
    renderWithStore(<ScreenHeader title="Edit" back />);
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot', () => {
    renderWithStore(<ScreenHeader title="Teams" right={<Text>+</Text>} />);
    expect(screen.getByText('+')).toBeTruthy();
  });
});
