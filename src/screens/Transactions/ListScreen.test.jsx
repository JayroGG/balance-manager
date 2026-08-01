// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import { baseApi } from '../../services/api/baseApi';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import prefsReducer from '../../reducers/prefs';
import activityReducer from '../../reducers/activity';
import { monthShortNames } from '../../utils/dates';
import { formatMoney } from '../../utils/money';
import TransactionsList from './ListScreen';

// The totals render via formatMoney, whose currency string is ICU-dependent ('$70.00' with full
// ICU vs 'USD 70.00' in the bare Node test env) — derive the expected text the same way.
const money = (amount) => formatMoney(amount, 'USD');

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

it('defaults to newest-first order', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  const order = ['JulyTx', 'LoanOut', 'MarchTx'];
  const texts = screen.getAllByText(/Tx|LoanOut/).map((el) => el.props.children);
  const indices = order.map((label) => texts.indexOf(label));
  expect(indices).toEqual([0, 1, 2]);
});

it('the sort toggle flips to oldest-first order', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  fireEvent.press(screen.getByTestId('sort-toggle'));

  const order = ['MarchTx', 'LoanOut', 'JulyTx'];
  const texts = screen.getAllByText(/Tx|LoanOut/).map((el) => el.props.children);
  const indices = order.map((label) => texts.indexOf(label));
  expect(indices).toEqual([0, 1, 2]);
});

it('the totals figure cycles net -> income -> expense and back, excluding loan journal rows', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  // Default view = current year, all months: JulyTx (-40), MarchTx (-30) count; LoanOut (loan_id
  // set, -25) is excluded from every total even though it's rendered in the list.
  expect(screen.getByText('LoanOut')).toBeTruthy();

  // Initially only the net figure (income - expense) is shown.
  expect(screen.getByText(money(-70))).toBeTruthy();
  expect(screen.queryByText(money(0))).toBeNull();
  expect(screen.queryByText(money(70))).toBeNull();

  fireEvent.press(screen.getByTestId('totals-cycle'));
  expect(screen.getByText(money(0))).toBeTruthy(); // income total
  expect(screen.queryByText(money(-70))).toBeNull();

  fireEvent.press(screen.getByTestId('totals-cycle'));
  expect(screen.getByText(money(70))).toBeTruthy(); // expense total
  expect(screen.queryByText(money(0))).toBeNull();

  fireEvent.press(screen.getByTestId('totals-cycle'));
  expect(screen.getByText(money(-70))).toBeTruthy(); // back to net
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

// ADR-019: a team context is only "confirmed" once it resolves in the getTeams cache. With an
// active team and an empty roster cache, the totals bar must render a skeleton — never a figure,
// never a 0.00 placeholder — even though the transactions/balance fetches succeed.
it('renders no totals figure — only a skeleton — under an unconfirmed team context', async () => {
  const store = configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      prefs: prefsReducer,
      activity: activityReducer,
    }),
    preloadedState: {
      auth: { token: null, user: null, bypass: false, bootstrapped: true },
      context: { activeTeamId: 5 }, // active team, roster cache never fetched — the P2 case
    },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    enhancers: (gde) => gde({ autoBatch: false }),
  });

  render(
    <Provider store={store}>
      <TransactionsList />
    </Provider>,
  );
  await screen.findByText('JulyTx');

  expect(screen.queryByTestId('totals-cycle')).toBeNull();
  expect(screen.getByTestId('totals-skeleton')).toBeTruthy();
  expect(screen.queryByText(money(-70))).toBeNull();
});
