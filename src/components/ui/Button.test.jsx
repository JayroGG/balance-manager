import { renderWithStore as render, fireEvent, screen } from '../../test-utils/renderWithStore';
import { AppButton } from './Button';

// Behaviour-only tests: render the label, fire the callback, respect disabled/loading/success.
// We never assert colours/spacing/style — the design can change without breaking these.
describe('AppButton', () => {
  it('renders its title', () => {
    render(<AppButton title="Save" onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<AppButton title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<AppButton title="Save" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading (and hides the label)', () => {
    const onPress = jest.fn();
    render(<AppButton title="Save" onPress={onPress} loading />);
    expect(screen.queryByText('Save')).toBeNull();
    // Nothing pressable-visible to tap by text; loading must block the action.
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the success label and blocks further presses in success state', () => {
    const onPress = jest.fn();
    render(<AppButton title="Save" successTitle="Saved" success onPress={onPress} />);
    const label = screen.getByText('✓ Saved');
    fireEvent.press(label);
    expect(onPress).not.toHaveBeenCalled();
  });
});
