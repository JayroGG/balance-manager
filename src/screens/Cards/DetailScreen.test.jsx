jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '1' }),
  useNavigation: () => ({ popToTop: jest.fn() }),
  Link: ({ children }) => children,
}));
jest.mock('../../utils/dates', () => ({ ...jest.requireActual('../../utils/dates'), todayISODate: () => '2026-11-20' }));

import './i18nTest';
import { waitFor } from '@testing-library/react-native';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import CardDetail from './DetailScreen';

const m = (n) => formatMoney(n, 'USD', { showCurrency: 'symbol' });
const full = (n) => formatMoney(n, 'USD');
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const card = (extra) => ({ id: 1, name: 'Visa', cut_day: 5, due_day: 25, credit_limit: 5000, last_cut: '2026-11-05', due_date: '2026-11-25', ...extra });
const tx = (id, type, amount, occurred_at, description) => ({ id, type, amount, occurred_at, description, card_id: 1 });
const charges = [tx(1, 'expense', 1200, '2026-11-02', 'Groceries'), tx(2, 'expense', 800, '2026-11-10', 'Fuel')];
let current;
let history;
beforeEach(() => {
  history = charges;
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const { pathname } = new URL(req.url);
    if (req.method === 'POST') return Promise.resolve(jsonResponse(card({ owed: 1500, statement_balance: 700, current_period: 800 }), 201));
    if (pathname === '/cards/1') return Promise.resolve(jsonResponse(current));
    if (pathname === '/transactions') return Promise.resolve(jsonResponse({ items: history, next_cursor: null, totals: {} }));
    if (pathname === '/balance') return Promise.resolve(jsonResponse({ currency: 'USD', vaults: [] }));
    return Promise.resolve(jsonResponse([]));
  });
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('renders owed, statement, current period and the history rows that add up to owed', async () => {
  current = card({ owed: 2000, statement_balance: 1200, current_period: 800 });
  renderWithStore(<CardDetail />);
  expect((await screen.findAllByText(full(2000))).length).toBeGreaterThan(0);
  expect(screen.getByText(`Pay ${full(1200)} by ${formatDate('2026-11-25')}`)).toBeTruthy();
  expect(screen.getAllByText(m(1200))).toHaveLength(2); // statement figure + the 1,200 charge
  expect(await screen.findByText('Groceries')).toBeTruthy();
  // charges 1,200 + 800 = owed 2,000; current period 800 = the post-cut charge. Limit usage 2,000 of 5,000.
  expect(screen.getAllByText(m(800))).toHaveLength(2);
  expect(screen.getByText(`${m(2000)} of ${m(5000)} used`)).toBeTruthy();
});

it('shows payments as neutral "Card payment" rows (500 paid → owed 1,500, statement 700)', async () => {
  current = card({ owed: 1500, statement_balance: 700, current_period: 800 });
  history = [...charges, tx(3, 'card_payment', 500, '2026-11-12')];
  renderWithStore(<CardDetail />);
  expect((await screen.findAllByText(full(1500))).length).toBeGreaterThan(0);
  expect(screen.getByText(`Pay ${full(700)} by ${formatDate('2026-11-25')}`)).toBeTruthy();
  expect(await screen.findByText('Card payment')).toBeTruthy();
  expect(screen.getByText(m(500))).toBeTruthy();
});

it('fully paid statement: statement 0, owed 800, delete refused while owed > 0', async () => {
  current = card({ owed: 800, statement_balance: 0, current_period: 800 });
  renderWithStore(<CardDetail />);
  expect((await screen.findAllByText(full(800))).length).toBeGreaterThan(0);
  expect(screen.getByText('Nothing due this statement')).toBeTruthy();
  expect(screen.getByText('Pay the card in full before deleting')).toBeTruthy();
});

it('flags overdue', async () => {
  current = card({ owed: 2000, statement_balance: 1200, current_period: 800, due_date: '2026-11-10' });
  renderWithStore(<CardDetail />);
  expect(await screen.findByText(`Overdue since ${formatDate('2026-11-10')}`)).toBeTruthy();
});

it('pay flow prefills the statement balance, blocks > owed, and posts amount + date', async () => {
  current = card({ owed: 2000, statement_balance: 1200, current_period: 800 });
  renderWithStore(<CardDetail />);
  fireEvent.press(await screen.findByText('Pay card'));
  const amount = screen.getByDisplayValue('1200');
  expect(screen.getByDisplayValue('2026-11-20')).toBeTruthy();
  fireEvent.changeText(amount, '2500');
  expect(screen.getByText('Cannot pay more than the card owes')).toBeTruthy();
  fireEvent.changeText(amount, '500');
  fireEvent.press(screen.getByText('Confirm'));
  await waitFor(() => expect(global.fetch.mock.calls.some((c) => c[0].method === 'POST')).toBe(true));
  const post = global.fetch.mock.calls.map((c) => c[0]).find((r) => r.method === 'POST');
  expect(new URL(post.url).pathname).toBe('/cards/1/pay');
  expect(JSON.parse(await post.clone().text())).toEqual({ amount: 500, occurred_at: '2026-11-20' });
});
