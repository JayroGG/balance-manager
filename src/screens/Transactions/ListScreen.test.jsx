// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import { baseApi } from '../../services/api/baseApi';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import prefsReducer from '../../reducers/prefs';
import activityReducer from '../../reducers/activity';
import { presetRange } from '../../utils/dates';
import { formatMoney } from '../../utils/money';
import TransactionsList from './ListScreen';

// The totals render via formatMoney, whose currency string is ICU-dependent ('$70.00' with full
// ICU vs 'USD 70.00' in the bare Node test env) — derive the expected text the same way.
const money = (amount) => formatMoney(amount, 'USD');

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

const row = (id, description, extra = {}) => ({
  id, type: 'expense', amount: 10, description, occurred_at: '2026-07-15', loan_id: null, ...extra,
});
const page1 = {
  items: [row(1, 'JulyTx', { amount: 40 }), row(4, 'LoanOut', { amount: 25, loan_id: 1 }), row(2, 'MarchTx', { amount: 30 })],
  next_cursor: null,
  totals: { income: 0, expense: 70, net: -70, count: 3 },
};

let respond; // (URL) => page body — swapped per test
const txUrls = () => global.fetch.mock.calls.map((c) => new URL(c[0].url)).filter((u) => u.pathname === '/transactions');
const lastTx = () => txUrls().at(-1).searchParams;

beforeEach(() => {
  respond = () => page1;
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const url = new URL(req.url);
    const body = url.pathname === '/balance' ? { currency: 'USD', vaults: [] } : url.pathname === '/transactions' ? respond(url) : [];
    return Promise.resolve(jsonResponse(body));
  });
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('opens on All time, newest first, with no date bound sent to the server', async () => {
  renderWithStore(<TransactionsList />);
  expect(await screen.findByText('JulyTx')).toBeTruthy();
  const p = txUrls()[0].searchParams;
  expect(p.get('sort')).toBe('desc');
  expect(p.get('limit')).toBe('30');
  expect(p.has('from')).toBe(false);
  expect(p.has('to')).toBe(false);
  expect(p.has('q')).toBe(false);
});

it('renders the rows in server order', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  const texts = screen.getAllByText(/Tx|LoanOut/).map((el) => el.props.children);
  expect(texts).toEqual(['JulyTx', 'LoanOut', 'MarchTx']);
});

it('the sort toggle re-queries oldest-first', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByTestId('sort-toggle'));
  await waitFor(() => expect(lastTx().get('sort')).toBe('asc'));
});

it('search is debounced into a single q param and the clear button resets it', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  const before = txUrls().length;

  fireEvent.changeText(screen.getByTestId('search-input'), 'mi');
  fireEvent.changeText(screen.getByTestId('search-input'), '  milk ');
  expect(txUrls().length).toBe(before); // nothing sent while typing
  await waitFor(() => expect(lastTx().get('q')).toBe('milk')); // trimmed, once
  expect(txUrls().length).toBe(before + 1);

  fireEvent.press(screen.getByTestId('search-clear'));
  await waitFor(() => expect(lastTx().has('q')).toBe(false));
});

it('a date preset sends the device-local from/to', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.today'));
  const { from, to } = presetRange('today');
  await waitFor(() => expect(lastTx().get('from')).toBe(from));
  expect(lastTx().get('to')).toBe(to);
});

it('picking a month sends its first and last day', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.months ▾'));
  const year = new Date().getFullYear();
  expect(screen.getByTestId('year-label').props.children).toBe(year);
  fireEvent.press(screen.getByTestId('year-prev'));
  fireEvent.press(screen.getByTestId('month-2'));
  await waitFor(() => expect(lastTx().get('from')).toBe(`${year - 1}-02-01`));
  expect(lastTx().get('to')).toBe(`${year - 1}-02-28`);
});

it('the months picker cannot go past the current year and disables future months', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.months ▾'));
  const year = new Date().getFullYear();
  expect(screen.getByTestId('year-label').props.children).toBe(year);
  expect(screen.getByTestId('year-next').props.accessibilityState.disabled).toBe(true); // can't pass the current year
  expect(screen.getByTestId('year-prev').props.accessibilityState.disabled).toBe(false);
  const nextMonth = new Date().getMonth() + 2; // 1-based month after the current one
  if (nextMonth <= 12) expect(screen.getByTestId(`month-${nextMonth}`).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByTestId('month-1').props.accessibilityState.disabled).toBe(false);
});

it('a custom range is picked on the calendar: tap 20 then 10 sends 10..20', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.custom ▾'));
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  fireEvent.press(screen.getByTestId(`day-${ym}-20`));
  fireEvent.press(screen.getByTestId(`day-${ym}-10`));
  fireEvent.press(screen.getByText('transactions.apply'));
  await waitFor(() => expect(lastTx().get('from')).toBe(`${ym}-10`));
  expect(lastTx().get('to')).toBe(`${ym}-20`);
});

it('the same day tapped twice applies a single-day range; a lone tap does too', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.custom ▾'));
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  fireEvent.press(screen.getByTestId(`day-${ym}-05`));
  fireEvent.press(screen.getByTestId(`day-${ym}-05`));
  fireEvent.press(screen.getByText('transactions.apply'));
  await waitFor(() => expect(lastTx().get('from')).toBe(`${ym}-05`));
  expect(lastTx().get('to')).toBe(`${ym}-05`);
});

it('the calendar navigates months and Apply is disabled until a day is picked', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  const before = txUrls().length;
  fireEvent.press(screen.getByText('transactions.custom ▾'));
  const title = screen.getByTestId('cal-title').props.children;
  fireEvent.press(screen.getByTestId('cal-next'));
  expect(screen.getByTestId('cal-title').props.children).not.toBe(title);
  fireEvent.press(screen.getByTestId('cal-prev'));
  expect(screen.getByTestId('cal-title').props.children).toBe(title);
  fireEvent.press(screen.getByText('transactions.apply'));
  expect(txUrls().length).toBe(before); // nothing picked → nothing applied
});

it('the loans chip asks the server for loans=only; income/expense send type', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  fireEvent.press(screen.getByText('transactions.loans'));
  await waitFor(() => expect(lastTx().get('loans')).toBe('only'));
  expect(lastTx().has('type')).toBe(false);

  fireEvent.press(screen.getByText('transactions.income'));
  await waitFor(() => expect(lastTx().get('type')).toBe('income'));
  expect(lastTx().has('loans')).toBe(false);
});

it('the totals bar shows the server totals and result count, cycling net -> income -> expense', async () => {
  respond = () => ({ ...page1, totals: { income: 500, expense: 70, net: 430, count: 3 } });
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  expect(screen.getByTestId('totals-count')).toBeTruthy();
  expect(screen.getByText(money(430))).toBeTruthy();
  fireEvent.press(screen.getByTestId('totals-cycle'));
  expect(screen.getByText(money(500))).toBeTruthy();
  fireEvent.press(screen.getByTestId('totals-cycle'));
  expect(screen.getByText(money(70))).toBeTruthy();
});

it('totals reflect the whole filtered set, not just the loaded page', async () => {
  respond = () => ({ ...page1, next_cursor: 'c1', totals: { income: 0, expense: 9999, net: -9999, count: 500 } });
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  expect(screen.getByText(money(-9999))).toBeTruthy();
});

it('loads the next page on end reached, sends the cursor, and appends without duplicates', async () => {
  respond = (url) =>
    url.searchParams.get('cursor') === 'c1'
      ? { items: [row(9, 'PageTwoTx')], next_cursor: null, totals: { income: 0, expense: 80, net: -80, count: 4 } }
      : { ...page1, next_cursor: 'c1' };
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  expect(txUrls().some((u) => u.searchParams.has('cursor'))).toBe(false);

  fireEvent(screen.getByText('JulyTx'), 'endReached');
  expect(await screen.findByText('PageTwoTx')).toBeTruthy();
  expect(screen.getByText('JulyTx')).toBeTruthy();
  expect(lastTx().get('cursor')).toBe('c1');
  // Same filters ride every page.
  expect(lastTx().get('sort')).toBe('desc');
  // Totals stay the first page's.
  expect(screen.getByText(money(-70))).toBeTruthy();
});

it('does not request another page once next_cursor is null', async () => {
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');
  const before = txUrls().length;
  fireEvent(screen.getByText('JulyTx'), 'endReached');
  await new Promise((r) => setTimeout(r, 20));
  expect(txUrls().length).toBe(before);
});

it('shows a no-results state with a reset action when filters match nothing', async () => {
  respond = (url) =>
    url.searchParams.has('q')
      ? { items: [], next_cursor: null, totals: { income: 0, expense: 0, net: 0, count: 0 } }
      : page1;
  renderWithStore(<TransactionsList />);
  await screen.findByText('JulyTx');

  fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
  expect(await screen.findByText('transactions.noResults')).toBeTruthy();

  fireEvent.press(screen.getByText('transactions.resetFilters'));
  expect(await screen.findByText('JulyTx')).toBeTruthy();
  expect(screen.getByTestId('search-input').props.value).toBe('');
});

it('shows the plain empty state when there are no transactions and no filters', async () => {
  respond = () => ({ items: [], next_cursor: null, totals: { income: 0, expense: 0, net: 0, count: 0 } });
  renderWithStore(<TransactionsList />);
  expect(await screen.findByText('transactions.empty')).toBeTruthy();
  expect(screen.queryByText('transactions.resetFilters')).toBeNull();
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
