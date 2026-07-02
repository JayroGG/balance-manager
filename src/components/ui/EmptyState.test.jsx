import { renderWithStore as render, screen } from '../../test-utils/renderWithStore';
import { EmptyState } from './EmptyState';

// Behaviour-only: the provided text is rendered. (Store wrapper: Muted reads useTheme.)
describe('EmptyState', () => {
  it('renders the given text', () => {
    render(<EmptyState text="No transactions yet" />);
    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});
