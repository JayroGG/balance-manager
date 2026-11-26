import { StyleSheet } from 'react-native';
import { renderWithStore, screen } from '../../test-utils/renderWithStore';
import { makeColors } from '../theme';
import { MoneyText } from './MoneyText';

// Behaviour-only: the component renders the formatted amount (delegated to formatMoney).
// Match by value substring (regex), not exact Intl symbol/spacing — design/locale can vary.
// Store wrapper: `signed` reads useTheme().
const danger = makeColors('light').danger;
const colorOf = (node) => StyleSheet.flatten(node.props.style)?.color;

describe('MoneyText', () => {
  it('renders the formatted amount', () => {
    renderWithStore(<MoneyText amount={1234.5} currency="USD" />);
    expect(screen.getByText(/1,234\.50/)).toBeTruthy();
  });

  it('renders zero for a nullish amount', () => {
    renderWithStore(<MoneyText amount={null} currency="USD" />);
    expect(screen.getByText(/0\.00/)).toBeTruthy();
  });

  it('renders a currency marker by default', () => {
    renderWithStore(<MoneyText amount={1234.5} currency="MXN" />);
    expect(screen.getByText(/\$|MXN|MX/)).toBeTruthy();
  });

  it('renders no currency marker when showCurrency is false', () => {
    renderWithStore(<MoneyText amount={1234.5} currency="MXN" showCurrency={false} />);
    const node = screen.getByText(/1,234\.50/);
    expect(node.props.children).not.toMatch(/\$|MXN|MX/);
  });

  it('paints a negative amount in the danger color when signed (ADR-022)', () => {
    renderWithStore(<MoneyText amount={-500} currency="USD" signed style={{ color: '#fff' }} />);
    expect(colorOf(screen.getByText(/500\.00/))).toBe(danger);
  });

  it('keeps its own color for positive, zero and unsigned amounts', () => {
    renderWithStore(
      <>
        <MoneyText amount={555} currency="USD" signed style={{ color: '#111' }} />
        <MoneyText amount={0} currency="USD" signed style={{ color: '#222' }} />
        <MoneyText amount={-70} currency="USD" style={{ color: '#333' }} />
      </>,
    );
    expect(colorOf(screen.getByText(/555\.00/))).toBe('#111');
    expect(colorOf(screen.getByText(/^\D*0\.00$/))).toBe('#222');
    expect(colorOf(screen.getByText(/70\.00/))).toBe('#333');
  });
});
