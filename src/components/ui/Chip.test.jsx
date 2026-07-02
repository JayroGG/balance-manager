import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import { Chip } from './Chip';

// Behaviour-only: label renders, press fires the callback. Active/dot are visual states, not asserted.
describe('Chip', () => {
  it('renders its label', () => {
    renderWithStore(<Chip label="Expense" onPress={() => {}} />);
    expect(screen.getByText('Expense')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderWithStore(<Chip label="Expense" onPress={onPress} />);
    fireEvent.press(screen.getByText('Expense'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('still renders label and fires onPress with a dot', () => {
    const onPress = jest.fn();
    renderWithStore(<Chip label="Design" dot="#7C3AED" onPress={onPress} />);
    fireEvent.press(screen.getByText('Design'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
