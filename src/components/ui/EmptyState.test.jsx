import { render, screen } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

// Behaviour-only: the provided text is rendered.
describe('EmptyState', () => {
  it('renders the given text', () => {
    render(<EmptyState text="No transactions yet" />);
    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});
