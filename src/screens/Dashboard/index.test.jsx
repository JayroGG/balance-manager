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

// Mirrors renderWithStore's makeStore (src/test-utils/renderWithStore.jsx) but lets ADR-019 tests seed
// a non-null `context.activeTeamId` — renderWithStore itself has no seam for that.
const renderWithTeamContext = (ui, activeTeamId) => {
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
      context: { activeTeamId },
    },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    enhancers: (gde) => gde({ autoBatch: false }),
  });
  return { ...render(<Provider store={store}>{ui}</Provider>), store };
};

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

// ADR-019: a monetary figure is never rendered unless the context that owns it is confirmed.
describe('cache trust gate (ADR-019)', () => {
  it('renders no monetary text at all under an unconfirmed team context', async () => {
    // activeTeamId 99 does not resolve in the /teams response below — the exact P2 case.
    mockFetch(baseBalance);
    renderWithTeamContext(<Dashboard />, 99);

    // Let the getTeams + balance fetches resolve.
    await screen.findByText('dashboard.vaults');

    expect(screen.queryAllByText(/\d/)).toHaveLength(0);
    // Skeletons (accessibilityRole="progressbar") stand in for the hero + vault-row figures instead.
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('hero-cycle')).toBeNull();
  });

  it('renders figures normally once the team context is confirmed', async () => {
    global.fetch.mockReset();
    global.fetch.mockImplementation((req) => {
      const url = req.url;
      if (url.includes('/balance')) return Promise.resolve(jsonResponse(baseBalance));
      if (url.includes('/shopping-lists')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/teams')) return Promise.resolve(jsonResponse([{ id: 7, name: 'Acme', role: 'owner' }]));
      if (url.includes('/events')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}));
    });
    renderWithTeamContext(<Dashboard />, 7);

    await screen.findByTestId('hero-cycle');
    expect(screen.getByText('dashboard.total')).toBeTruthy();
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('a genuinely-zero figure in a confirmed (personal) context still renders as a number', async () => {
    mockFetch({ ...baseBalance, total: 0, available: 0, vaults: [] });
    renderWithStore(<Dashboard />);

    await screen.findByTestId('hero-cycle');
    expect(screen.queryAllByText(/\d/).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});
