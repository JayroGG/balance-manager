import { render, screen } from '@testing-library/react-native';
import { MoneyText } from './MoneyText';

// Behaviour-only: the component renders the formatted amount (delegated to formatMoney).
// Match by value substring (regex), not exact Intl symbol/spacing — design/locale can vary.
describe('MoneyText', () => {
  it('renders the formatted amount', () => {
    render(<MoneyText amount={1234.5} currency="USD" />);
    expect(screen.getByText(/1,234\.50/)).toBeTruthy();
  });

  it('renders zero for a nullish amount', () => {
    render(<MoneyText amount={null} currency="USD" />);
    expect(screen.getByText(/0\.00/)).toBeTruthy();
  });
});
