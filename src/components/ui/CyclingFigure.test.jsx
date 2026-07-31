import { Provider } from 'react-redux';
import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import { CyclingFigure } from './CyclingFigure';

const steps = [
  { key: 'net', label: 'Balance', amount: -70, color: '#000' },
  { key: 'income', label: 'Income', amount: 0, color: '#0a0' },
  { key: 'expense', label: 'Expense', amount: 70, color: '#a00' },
];

describe('CyclingFigure', () => {
  it('renders the first step label and amount', () => {
    renderWithStore(<CyclingFigure steps={steps} currency="USD" dotColor="#333" testID="fig" />);
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText(/70\.00/)).toBeTruthy();
  });

  it('advances to the next step on press', () => {
    renderWithStore(<CyclingFigure steps={steps} currency="USD" dotColor="#333" testID="fig" />);
    fireEvent.press(screen.getByTestId('fig'));
    expect(screen.getByText('Income')).toBeTruthy();
  });

  it('wraps around past the last step', () => {
    renderWithStore(<CyclingFigure steps={steps} currency="USD" dotColor="#333" testID="fig" />);
    const btn = screen.getByTestId('fig');
    fireEvent.press(btn);
    fireEvent.press(btn);
    fireEvent.press(btn);
    expect(screen.getByText('Balance')).toBeTruthy();
  });

  it('renders a single-step list without a dot row and does not crash on press', () => {
    const single = [{ key: 'total', label: 'Total', amount: 100, color: '#000' }];
    renderWithStore(<CyclingFigure steps={single} currency="USD" dotColor="#333" testID="fig" />);
    expect(screen.getByText('Total')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fig'));
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('renders nothing when steps is empty or nullish', () => {
    const { toJSON: emptyJson } = renderWithStore(
      <CyclingFigure steps={[]} currency="USD" dotColor="#333" testID="fig" />
    );
    expect(emptyJson()).toBeNull();

    const { toJSON: nullJson } = renderWithStore(
      <CyclingFigure steps={null} currency="USD" dotColor="#333" testID="fig2" />
    );
    expect(nullJson()).toBeNull();
  });

  it('clamps the index instead of blanking when steps shrinks while parked on the last index', () => {
    const three = [
      { key: 'a', label: 'A', amount: 1, color: '#000' },
      { key: 'b', label: 'B', amount: 2, color: '#000' },
      { key: 'c', label: 'C', amount: 3, color: '#000' },
    ];
    const { rerender, store } = renderWithStore(
      <CyclingFigure steps={three} currency="USD" dotColor="#333" testID="fig" />
    );
    const btn = screen.getByTestId('fig');
    fireEvent.press(btn); // -> B
    fireEvent.press(btn); // -> C (index 2)

    const two = [
      { key: 'a', label: 'A', amount: 1, color: '#000' },
      { key: 'b', label: 'B', amount: 2, color: '#000' },
    ];
    rerender(
      <Provider store={store}>
        <CyclingFigure steps={two} currency="USD" dotColor="#333" testID="fig" />
      </Provider>
    );
    // index 2 % 2 === 0 -> clamps back to the first step, not a blank render.
    expect(screen.getByText('A')).toBeTruthy();
  });
});
