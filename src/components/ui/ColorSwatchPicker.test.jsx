import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { PRESET_TEAM_COLORS } from '../theme';

// Behaviour-only: swatches and manual typing both surface through onChange.
describe('ColorSwatchPicker', () => {
  it('renders the 10 preset swatches', () => {
    renderWithStore(<ColorSwatchPicker value="" onChange={() => {}} />);
    PRESET_TEAM_COLORS.forEach((hex) => {
      expect(screen.getByTestId(`swatch-${hex}`)).toBeTruthy();
    });
  });

  it('pressing a swatch emits its hex', () => {
    const onChange = jest.fn();
    renderWithStore(<ColorSwatchPicker value="" onChange={onChange} />);
    fireEvent.press(screen.getByTestId('swatch-#0D9488'));
    expect(onChange).toHaveBeenCalledWith('#0D9488');
  });

  it('typing in the hex field emits the raw text', () => {
    const onChange = jest.fn();
    renderWithStore(<ColorSwatchPicker value="" onChange={onChange} />);
    fireEvent.changeText(screen.getByPlaceholderText('#RRGGBB'), '#ABCDEF');
    expect(onChange).toHaveBeenCalledWith('#ABCDEF');
  });
});
