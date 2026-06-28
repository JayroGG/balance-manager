import { render, fireEvent, screen } from '@testing-library/react-native';
import { Chip } from './Chip';

// Behaviour-only: label renders, press fires the callback. Active is a visual state, not asserted.
describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Expense" onPress={() => {}} />);
    expect(screen.getByText('Expense')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Chip label="Expense" onPress={onPress} />);
    fireEvent.press(screen.getByText('Expense'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
