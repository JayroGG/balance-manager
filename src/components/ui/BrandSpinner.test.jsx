import { renderWithStore as render, screen } from '../../test-utils/renderWithStore';
import { BrandSpinner } from './BrandSpinner';

// Behaviour-only: it renders as a progress indicator. (Store wrapper: reads useTheme.)
describe('BrandSpinner', () => {
  it('renders a progressbar', () => {
    render(<BrandSpinner />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
