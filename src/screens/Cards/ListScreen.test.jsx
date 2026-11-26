jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  Link: ({ children }) => children,
}));
jest.mock('../../utils/dates', () => ({ ...jest.requireActual('../../utils/dates'), todayISODate: () => '2026-11-20' }));

import './i18nTest';
import { renderWithStore, screen } from '../../test-utils/renderWithStore';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import CardsList from './ListScreen';

const m = (n) => formatMoney(n, 'USD', { showCurrency: 'symbol' });
const jsonResponse = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

// BE worked example, today 2026-11-20, cut 5 / due 25.
const card = (extra) => ({ id: 1, name: 'Visa', cut_day: 5, due_day: 25, credit_limit: null, last_cut: '2026-11-05', due_date: '2026-11-25', ...extra });
let cards;
beforeEach(() => {
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const { pathname } = new URL(req.url);
    return Promise.resolve(jsonResponse(pathname === '/cards' ? cards : pathname === '/balance' ? { currency: 'USD', vaults: [] } : []));
  });
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('shows owed and "Pay 1,200 by 11-25" (charges 1,200 + 800)', async () => {
  cards = [card({ owed: 2000, statement_balance: 1200, current_period: 800 })];
  renderWithStore(<CardsList />);
  expect(await screen.findByText(m(2000))).toBeTruthy();
  expect(screen.getByText(`Pay ${m(1200)} by ${formatDate('2026-11-25')}`)).toBeTruthy();
  expect(screen.queryByText(/Overdue/)).toBeNull();
});

it('after paying 500: owed 1,500, statement 700', async () => {
  cards = [card({ owed: 1500, statement_balance: 700, current_period: 800 })];
  renderWithStore(<CardsList />);
  expect(await screen.findByText(m(1500))).toBeTruthy();
  expect(screen.getByText(`Pay ${m(700)} by ${formatDate('2026-11-25')}`)).toBeTruthy();
});

it('after paying 700 more: statement 0, owed 800 → nothing due', async () => {
  cards = [card({ owed: 800, statement_balance: 0, current_period: 800 })];
  renderWithStore(<CardsList />);
  expect(await screen.findByText(m(800))).toBeTruthy();
  expect(screen.getByText('Nothing due this statement')).toBeTruthy();
});

it('flags an overdue statement', async () => {
  cards = [card({ owed: 2000, statement_balance: 1200, current_period: 800, due_date: '2026-11-10' })];
  renderWithStore(<CardsList />);
  expect(await screen.findByText(`Overdue since ${formatDate('2026-11-10')}`)).toBeTruthy();
});

it('renders the empty state', async () => {
  cards = [];
  renderWithStore(<CardsList />);
  expect(await screen.findByText('No cards yet')).toBeTruthy();
});
