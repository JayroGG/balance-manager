// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import Dashboard from './index';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

const mockPushSpy = jest.fn();
const mockNavigateSpy = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPushSpy, navigate: mockNavigateSpy }),
  Link: ({ children }) => children,
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const baseBalance = {
  total: 100,
  available: 60,
  lent: 0,
  currency: 'USD',
  vaults: [{ id: 1, name: 'Trip', balance: 40, target: 0 }],
};

const mockFetch = (balance) => {
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const url = req.url;
    if (url.includes('/balance')) return Promise.resolve(jsonResponse(balance));
    if (url.includes('/shopping-lists')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/teams')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/events')) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({}));
  });
};

beforeEach(() => {
  mockPushSpy.mockReset();
  mockNavigateSpy.mockReset();
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('cycles the hero Total -> Available -> Total when there is nothing lent', async () => {
  mockFetch(baseBalance);
  renderWithStore(<Dashboard />);

  await screen.findByText('dashboard.total');
  expect(screen.queryByText('dashboard.available')).toBeNull();
  expect(screen.queryByText('dashboard.lent')).toBeNull();

  fireEvent.press(screen.getByTestId('hero-cycle'));
  expect(screen.getByText('dashboard.available')).toBeTruthy();

  fireEvent.press(screen.getByTestId('hero-cycle'));
  expect(screen.getByText('dashboard.total')).toBeTruthy();
  expect(screen.queryByText('dashboard.lent')).toBeNull();
});

it('cycles Total -> Available -> Lent -> Total when there is an outstanding loan', async () => {
  mockFetch({ ...baseBalance, lent: 25 });
  renderWithStore(<Dashboard />);

  await screen.findByText('dashboard.total');

  fireEvent.press(screen.getByTestId('hero-cycle'));
  expect(screen.getByText('dashboard.available')).toBeTruthy();

  fireEvent.press(screen.getByTestId('hero-cycle'));
  expect(screen.getByText('dashboard.lent')).toBeTruthy();

  fireEvent.press(screen.getByTestId('hero-cycle'));
  expect(screen.getByText('dashboard.total')).toBeTruthy();
});

it('navigates to the vault detail route (not push) when a vault card is pressed', async () => {
  mockFetch(baseBalance);
  renderWithStore(<Dashboard />);

  await screen.findByText('Trip');
  fireEvent.press(screen.getByText('Trip'));

  expect(mockNavigateSpy).toHaveBeenCalledWith({
    pathname: '/(tabs)/vaults/[id]',
    params: { id: 1 },
  });
  expect(mockPushSpy).not.toHaveBeenCalledWith(
    expect.objectContaining({ pathname: '/(tabs)/vaults/[id]' }),
  );
});
