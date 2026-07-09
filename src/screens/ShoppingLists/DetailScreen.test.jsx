// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { waitFor } from '@testing-library/react-native';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import ShoppingListDetail from './DetailScreen';

// Behavioral coverage (not styling): the checkbox toggle and the checkout post the right contracts.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const mockApi = ({ list, items }) => {
  global.fetch.mockImplementation((req) => {
    const { url } = req;
    if (url.includes('/shopping-list-items')) return Promise.resolve(jsonResponse(items));
    if (url.includes('/checkout')) return Promise.resolve(jsonResponse({ ...list, status: 'purchased', transaction_id: 500 }));
    if (url.includes('/shopping-lists/')) return Promise.resolve(jsonResponse(list));
    if (url.includes('/categories')) return Promise.resolve(jsonResponse([{ id: 3, name: 'Food', kind: 'expense' }]));
    if (url.includes('/balance')) return Promise.resolve(jsonResponse({ currency: 'USD', total: 100, available: 100, vaults: [] }));
    return Promise.resolve(jsonResponse([]));
  });
};

const openList = { id: 7, user_id: 1, name: 'Supermarket', status: 'open', category_id: null, transaction_id: null };
const openItems = [
  { id: 31, list_id: 7, user_id: 1, name: 'Milk', qty: 1, price: 25.5, checked: true },
  { id: 32, list_id: 7, user_id: 1, name: 'Bread', qty: 1, price: 10, checked: false },
];

const requests = () => global.fetch.mock.calls.map((c) => c[0]);

beforeEach(() => {
  global.fetch.mockReset();
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('toggles an item by PUTting { checked } to /shopping-list-items/:id', async () => {
  mockApi({ list: openList, items: openItems });
  renderWithStore(<ShoppingListDetail />);

  const toggle = await screen.findByTestId('item-toggle-32');
  fireEvent.press(toggle);

  await waitFor(() => {
    const put = requests().find((r) => /\/shopping-list-items\/32$/.test(r.url) && r.method === 'PUT');
    expect(put).toBeDefined();
  });
  const put = requests().find((r) => /\/shopping-list-items\/32$/.test(r.url) && r.method === 'PUT');
  await expect(put.clone().json()).resolves.toEqual({ checked: true });
});

it('checks out with the edited amount → POST /shopping-lists/:id/checkout, no team_id in body', async () => {
  mockApi({ list: openList, items: openItems });
  renderWithStore(<ShoppingListDetail />);

  // A checked, priced item makes the Checkout affordance appear.
  fireEvent.press(await screen.findByText('lists.checkout'));

  const amount = await screen.findByTestId('checkout-amount');
  fireEvent.changeText(amount, '30'); // real ticket differs from the estimate
  fireEvent.press(screen.getByText('lists.confirmCheckout'));

  await waitFor(() => {
    const post = requests().find((r) => /\/shopping-lists\/7\/checkout$/.test(r.url) && r.method === 'POST');
    expect(post).toBeDefined();
  });
  const post = requests().find((r) => /\/shopping-lists\/7\/checkout$/.test(r.url) && r.method === 'POST');
  await expect(post.clone().json()).resolves.toEqual({ amount: 30 });
});

it('freezes a purchased list — no checkout or add-item affordances', async () => {
  mockApi({ list: { ...openList, status: 'purchased', transaction_id: 99 }, items: openItems });
  renderWithStore(<ShoppingListDetail />);

  expect(await screen.findByText('lists.frozenHint')).toBeTruthy();
  expect(screen.queryByText('lists.checkout')).toBeNull();
  expect(screen.queryByText('lists.addItem')).toBeNull();
});
