// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import { waitFor } from '@testing-library/react-native';
import { baseApi } from '../../services/api/baseApi';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import prefsReducer from '../../reducers/prefs';
import activityReducer from '../../reducers/activity';
import { StyleSheet } from 'react-native';
import { makeColors } from '../../components/theme';
import { formatMoney } from '../../utils/money';
import Dashboard from './index';

// Hero figures render via formatMoney, whose currency string is ICU-dependent — derive the expected
// text the same way the screen does.
const money = (amount) => formatMoney(amount, 'USD');

jest.mock('react-native-gesture-handler', () => require('../../test-utils/gestureMock'));
jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));
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
  useFocusEffect: (cb) => require('react').useEffect(cb, []),
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

// The hero shows every figure at once — no tap-to-cycle (that stays on the transactions totals bar).
it('renders available and total together, with no lent row when nothing is lent', async () => {
  mockFetch(baseBalance);
  renderWithStore(<Dashboard />);

  await screen.findByTestId('hero');
  expect(screen.getByText('dashboard.available')).toBeTruthy();
  expect(screen.getByText('dashboard.total')).toBeTruthy();
  expect(screen.queryByText('dashboard.lent')).toBeNull();

  expect(screen.getByText(money(60))).toBeTruthy();
  expect(screen.getByText(money(100))).toBeTruthy();
});

it('renders a negative available in the danger color (ADR-022)', async () => {
  mockFetch({ ...baseBalance, available: -500, total: 100 });
  renderWithStore(<Dashboard />);
  await screen.findByTestId('hero');
  const node = screen.getByText(money(-500));
  expect(StyleSheet.flatten(node.props.style).color).toBe(makeColors('light').danger);
  expect(StyleSheet.flatten(screen.getByText(money(100)).props.style).color).not.toBe(makeColors('light').danger);
});

it('renders the lent row only when there is an outstanding loan', async () => {
  mockFetch({ ...baseBalance, lent: 25 });
  renderWithStore(<Dashboard />);

  await screen.findByTestId('hero');
  expect(screen.getByText('dashboard.lent')).toBeTruthy();
  expect(screen.getByText(money(25))).toBeTruthy();
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
    expect(screen.queryByTestId('hero')).toBeNull();
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

    await screen.findByTestId('hero');
    expect(screen.getByText('dashboard.total')).toBeTruthy();
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('a genuinely-zero figure in a confirmed (personal) context still renders as a number', async () => {
    mockFetch({ ...baseBalance, total: 0, available: 0, vaults: [] });
    renderWithStore(<Dashboard />);

    await screen.findByTestId('hero');
    expect(screen.queryAllByText(/\d/).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});

// ADR-023 cards block — BE worked example: charges 1,200 + 800, statement 1,200 (due in the future → not overdue).
const cardsBalance = {
  ...baseBalance,
  cards_owed: 2000,
  cards: [
    { id: 1, name: 'Visa', owed: 800, statement_balance: 0, due_date: '2099-01-10' },
    { id: 2, name: 'Amex', owed: 1200, statement_balance: 1200, due_date: '2099-11-25' },
    { id: 3, name: 'Late', owed: 0, statement_balance: 300, due_date: '2099-12-30' },
  ],
};

it('hides the cards block when /balance has no cards', async () => {
  mockFetch(baseBalance);
  renderWithStore(<Dashboard />);
  await screen.findByTestId('hero');
  expect(screen.queryByTestId('cards-block')).toBeNull();
  mockFetch({ ...baseBalance, cards: [], cards_owed: 0 });
});

it('shows total owed and the earliest due card, and navigates to the cards list', async () => {
  mockFetch(cardsBalance);
  renderWithStore(<Dashboard />);
  await screen.findByTestId('cards-block');
  expect(screen.getByText(money(2000))).toBeTruthy();
  expect(screen.getByTestId('cards-next-due').props.children).toBe('cards.payBy');
  fireEvent.press(screen.getByTestId('cards-block'));
  expect(mockNavigateSpy).toHaveBeenCalledWith('/(tabs)/settings/cards');
});

it('flags an overdue next payment in the danger color', async () => {
  mockFetch({ ...cardsBalance, cards: [{ id: 2, name: 'Amex', owed: 1200, statement_balance: 1200, due_date: '2020-01-25' }] });
  renderWithStore(<Dashboard />);
  const node = await screen.findByTestId('cards-next-due');
  expect(StyleSheet.flatten(node.props.style).color).toBe(makeColors('light').danger);
});

it('shows "nothing due" when every statement is paid (owed 800, statement 0)', async () => {
  mockFetch({ ...cardsBalance, cards_owed: 800, cards: [cardsBalance.cards[0]] });
  renderWithStore(<Dashboard />);
  await screen.findByTestId('cards-block');
  expect(screen.getByText(money(800))).toBeTruthy();
  expect(screen.getByTestId('cards-next-due').props.children).toBe('cards.noneDue');
});

it('does not paint the cards block under an unconfirmed team context (ADR-019)', async () => {
  mockFetch(cardsBalance);
  renderWithTeamContext(<Dashboard />, 99);
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByTestId('cards-block')).toBeNull();
});

describe('Dashboard vaults block (top 3, order, see-all)', () => {
  const vs = [
    { id: 1, name: 'Zero', balance: 0, target: 0 },
    { id: 2, name: 'Bravo', balance: 10, target: 0 },
    { id: 3, name: 'Alpha', balance: 20, target: 0 },
    { id: 4, name: 'Delta', balance: 30, target: 0 },
    { id: 5, name: 'Echo', balance: 40, target: 0 },
  ];

  it('shows the first 3 non-empty vaults in server order and a see-all link', async () => {
    mockFetch({ ...baseBalance, vaults: vs });
    renderWithStore(<Dashboard />);
    expect(await screen.findByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Delta')).toBeTruthy();
    expect(screen.queryByText('Zero')).toBeNull();
    expect(screen.queryByText('Echo')).toBeNull();
    fireEvent.press(screen.getByText('dashboard.seeAllVaults'));
    expect(mockNavigateSpy).toHaveBeenCalledWith('/(tabs)/vaults');
  });

  it('shows empty text plus the link when every vault is empty', async () => {
    mockFetch({ ...baseBalance, vaults: [vs[0]] });
    renderWithStore(<Dashboard />);
    expect(await screen.findByText('dashboard.seeAllVaults')).toBeTruthy();
    expect(screen.queryByText('Zero')).toBeNull();
  });
});

describe('Dashboard top-3 uses the local order', () => {
  it('shows pending local order first', async () => {
    mockFetch({
      ...baseBalance,
      vaults: [
        { id: 1, name: 'Bravo', balance: 10, target: 0 },
        { id: 2, name: 'Alpha', balance: 20, target: 0 },
      ],
    });
    const { store } = renderWithStore(<Dashboard />);
    await screen.findByText('Bravo');
    const { saveOrder } = require('../../reducers/vaultOrder');
    const { act } = require('@testing-library/react-native');
    act(() => {
      store.dispatch(saveOrder({ userId: null, teamId: null, ids: [2, 1] }));
    });
    const names = screen.getAllByText(/^(Alpha|Bravo)$/).map((n) => n.props.children);
    expect(names).toEqual(['Alpha', 'Bravo']);
  });
});

// ADR-027: the old text link is gone; the balance card flips to a glass options menu.
describe('balance card flip menu (ADR-027)', () => {
  const mockWithTeams = (teams) => {
    mockFetch(baseBalance);
    const base = global.fetch.getMockImplementation();
    global.fetch.mockImplementation((req) =>
      req.url.includes('/teams') ? Promise.resolve(jsonResponse(teams)) : base(req),
    );
  };

  it('has no old transfer link', async () => {
    mockWithTeams([{ id: 2, name: 'Casa', role: 'owner' }]);
    renderWithStore(<Dashboard />);
    await screen.findByTestId('hero');
    expect(screen.queryByTestId('transfer-button')).toBeNull();
  });

  it('disables the transfer tile when there is no other owned context', async () => {
    mockWithTeams([]);
    renderWithStore(<Dashboard />);
    await screen.findByTestId('hero');
    fireEvent.press(screen.getByTestId('balance-flip-front'));
    expect(screen.getByTestId('transfer-tile').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('dashboard.transferNoDestination')).toBeTruthy();
    fireEvent.press(screen.getByTestId('transfer-tile'));
    expect(mockPushSpy).not.toHaveBeenCalled();
    expect(screen.getByText('dashboard.transferNoDestination')).toBeTruthy(); // tile press must not flip it back
    expect(screen.getAllByTestId('placeholder-tile')).toHaveLength(3);
    // the back face must not be one accessible blob: tiles stay individually reachable by VoiceOver
    expect(screen.getByTestId('balance-flip-back').props.accessible).toBe(false);
  });

  it('opens the transfer flow from the enabled tile and flips back', async () => {
    mockWithTeams([{ id: 2, name: 'Casa', role: 'owner' }]);
    renderWithStore(<Dashboard />);
    await screen.findByTestId('hero');
    await waitFor(() => expect(screen.getByTestId('transfer-tile').props.accessibilityState.disabled).toBe(false));
    fireEvent.press(screen.getByTestId('balance-flip-front'));
    fireEvent.press(screen.getByTestId('transfer-tile'));
    expect(mockPushSpy).toHaveBeenCalledWith('/(tabs)/dashboard/transfer');
  });

  it('flips back when the back face is tapped anywhere outside the tiles', async () => {
    mockWithTeams([{ id: 2, name: 'Casa', role: 'owner' }]);
    renderWithStore(<Dashboard />);
    await screen.findByTestId('hero');
    fireEvent.press(screen.getByTestId('balance-flip-front'));
    fireEvent.press(screen.getByTestId('balance-flip-back'));
    // flipped back: the back face (and its tiles) no longer take touches
    await waitFor(() => {
      fireEvent.press(screen.getByTestId('transfer-tile'));
      expect(mockPushSpy).not.toHaveBeenCalled();
    });
  });

  it('the hero is a flat (non-blurring) glass face over one static blur underlay', async () => {
    mockWithTeams([]);
    renderWithStore(<Dashboard />);
    const hero = await screen.findByTestId('hero');
    expect(hero.props.accessibilityLabel).toMatch(/^glass-(wash|solid)$/); // flat: never a native blur under rotation
    expect(screen.getByTestId('balance-flip-underlay')).toBeTruthy();
    expect(screen.getByTestId('glass-fill').props.accessibilityLabel).toMatch(/^glass-/);
  });
});
