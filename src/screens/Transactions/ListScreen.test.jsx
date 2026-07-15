// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import { monthShortNames } from '../../utils/dates';
import TransactionsList from './ListScreen';

// Derive the July label the same way the screen does, so the test is locale-independent.
const julyLabel = monthShortNames()[6];

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }) => children,
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Dates are relative to the current year so the default filter (this year) is clock-independent.
const Y = new Date().getFullYear();
const txs = [
  { id: 1, type: 'expense', amount: 40, description: 'JulyTx', occurred_at: `${Y}-07-15`, loan_id: null },
  { id: 2, type: 'expense', amount: 30, description: 'MarchTx', occurred_at: `${Y}-03-10`, loan_id: null },
  { id: 3, type: 'income', amount: 90, description: 'LastYearTx', occurred_at: `${Y - 1}-12-20`, loan_id: null },
  { id: 4, type: 'expense', amount: 25, description: 'LoanOut', occurred_at: `${Y}-07-05`, loan_id: 1 },
];

beforeEach(() => {
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) =>
    Promise.resolve(jsonResponse(req.url.includes('/balance') ? { currency: 'USD', vaults: [] } : txs)),
  );
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('defaults to the current year — shows this year, hides last year', async () => {
  renderWithStore(<TransactionsList />);
  expect(await screen.findByText('JulyTx')).toBeTruthy();
  expect(screen.getByText('MarchTx')).toBeTruthy();
  expect(screen.queryByText('LastYearTx')).toBeNull();
});

it('narrows to a single month when a month chip is selected', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  fireEvent.press(screen.getByText(julyLabel));

  expect(screen.getByText('JulyTx')).toBeTruthy();
  expect(screen.queryByText('MarchTx')).toBeNull();
});

it('shows every year when "All years" is picked from the dropdown', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  fireEvent.press(screen.getByTestId('year-dropdown'));
  fireEvent.press(screen.getByText('transactions.allYears'));

  expect(screen.getByText('JulyTx')).toBeTruthy();
  expect(screen.getByText('MarchTx')).toBeTruthy();
  expect(screen.getByText('LastYearTx')).toBeTruthy();
});

it('totals bar shows net/income/expense over visible rows, excluding loan journal rows', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  // Default view = current year, all months: JulyTx (-40), MarchTx (-30) count; LoanOut (loan_id
  // set, -25) is excluded from every total even though it's rendered in the list.
  expect(screen.getByText('LoanOut')).toBeTruthy();
  expect(screen.getByText('$70.00')).toBeTruthy(); // expense total
  expect(screen.getByText('$0.00')).toBeTruthy(); // income total
  expect(screen.getByText('-$70.00')).toBeTruthy(); // net = income - expense
});

it('the loans chip filters the list down to loan_id rows only', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  fireEvent.press(screen.getByText('transactions.loans'));

  expect(screen.getByText('LoanOut')).toBeTruthy();
  expect(screen.queryByText('JulyTx')).toBeNull();
  expect(screen.queryByText('MarchTx')).toBeNull();
});

it('renders a "Loan" badge on journal rows but not on regular rows', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  expect(screen.getAllByText('transactions.loan')).toHaveLength(1);
});
