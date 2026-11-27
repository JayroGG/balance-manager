jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }), Link: ({ children }) => children, useFocusEffect: (cb) => require('react').useEffect(cb, []) }));
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
const mockPans = [];
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const h = {};
      mockPans.push(h);
      const chain = new Proxy(
        {},
        {
          get: (_, name) => (fn) => {
            if (typeof fn === 'function') h[name] = fn;
            return chain;
          },
        },
      );
      return chain;
    },
  },
  GestureDetector: ({ children }) => children,
}));
jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));

import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { render, act, screen } from '@testing-library/react-native';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../../services/api/baseApi';
import '../../services/api';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import prefsReducer from '../../reducers/prefs';
import activityReducer from '../../reducers/activity';
import lockReducer from '../../reducers/lock';
import vaultOrderReducer, { saveOrder, orderSynced } from '../../reducers/vaultOrder';
import { startVaultOrderSync } from '../../reducers/vaultOrder/sync';
import Dashboard from '../Dashboard';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useOrderedVaults } from './reorder';

// The Vaults tab's own hook instance (it stays mounted next to the Dashboard).
function VaultsList() {
  const { data } = useGetBalanceQuery(null);
  useOrderedVaults(data?.vaults);
  return null;
}

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const V = { 1: ['Rent', 100], 2: ['Travel', 0], 3: ['Emergency', 300], 4: ['Gadgets', 400], 5: ['Gifts', 500] };
const bal = (ids) => ({
  currency: 'USD', total: 1000, available: 50, lent: 0,
  vaults: ids.map((id) => ({ id, name: V[id][0], balance: V[id][1], target: 0 })),
});
const names = ['Rent', 'Travel', 'Emergency', 'Gadgets', 'Gifts'];
const dash = () => screen.queryAllByText(new RegExp(`^(${names.join('|')})$`)).map((n) => n.props.children);

// The runtime has the React Compiler on; plain jest does not. Run this file under
// `npx jest -c jest.compiler.config.js` (npm run test:compiler) to cover the compiled Dashboard.
describe('Dashboard top-3 from a persisted post-sync state (expired hold), tabs mounted', () => {
  let server, stop;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove() {} });
    global.fetch.mockReset();
    global.fetch.mockImplementation((req) =>
      Promise.resolve(req.method === 'PUT' ? new Response(null, { status: 204 }) : json(req.url.includes('/balance') ? bal(server) : [])),
    );
  });
  afterEach(() => { stop?.(); jest.useRealTimers(); jest.restoreAllMocks(); });

  it('shows Rent, Gifts, Emergency when local == server == [1,2,5,3,4] and the hold has expired', async () => {
    server = [1, 2, 5, 3, 4];
    const store = configureStore({
      reducer: combineReducers({
        [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, context: contextReducer, prefs: prefsReducer,
        activity: activityReducer, lock: lockReducer, vaultOrder: vaultOrderReducer,
      }),
      preloadedState: {
        auth: { token: 't', user: { id: 1 }, bypass: false, bootstrapped: true },
        vaultOrder: { byKey: { '1:personal': { userId: 1, teamId: null, ids: [1, 2, 5, 3, 4], pending: false, awaiting: true } } },
      },
      middleware: (g) => g().concat(baseApi.middleware),
      enhancers: (g) => g({ autoBatch: false }),
    });
    stop = startVaultOrderSync(store, { delay: 1500 });
    render(<Provider store={store}><VaultsList /><Dashboard /></Provider>);
    await act(async () => jest.advanceTimersByTime(20));
    expect(dash().slice(0, 3)).toEqual(['Rent', 'Gifts', 'Emergency']);
    await act(async () => jest.advanceTimersByTime(61000)); // hold released by the timer
    expect(store.getState().vaultOrder.byKey['1:personal'].awaiting).toBe(false);
    expect(dash().slice(0, 3)).toEqual(['Rent', 'Gifts', 'Emergency']);
  });

  it('reorders in sequence, each drop visible on the Dashboard at once (store-driven, compiled)', async () => {
    server = [1, 2, 3, 4, 5];
    const store = configureStore({
      reducer: combineReducers({
        [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, context: contextReducer, prefs: prefsReducer,
        activity: activityReducer, lock: lockReducer, vaultOrder: vaultOrderReducer,
      }),
      preloadedState: { auth: { token: 't', user: { id: 1 }, bypass: false, bootstrapped: true } },
      middleware: (g) => g().concat(baseApi.middleware),
      enhancers: (g) => g({ autoBatch: false }),
    });
    stop = startVaultOrderSync(store, { delay: 1500 });
    render(<Provider store={store}><VaultsList /><Dashboard /></Provider>);
    await act(async () => jest.advanceTimersByTime(20));
    expect(dash().slice(0, 3)).toEqual(['Rent', 'Emergency', 'Gadgets']);
    const drop = (ids) => act(() => { store.dispatch(saveOrder({ userId: 1, teamId: null, ids })); });
    drop([1, 2, 5, 3, 4]);
    expect(dash().slice(0, 3)).toEqual(['Rent', 'Gifts', 'Emergency']);
    await act(async () => jest.advanceTimersByTime(1600)); // PUT ok
    server = [1, 2, 5, 3, 4];
    drop([5, 1, 2, 3, 4]);
    expect(dash().slice(0, 3)).toEqual(['Gifts', 'Rent', 'Emergency']);
    await act(async () => jest.advanceTimersByTime(1600));
    await act(async () => jest.advanceTimersByTime(70000)); // hold expires
    act(() => { store.dispatch({ type: 'activity/markSeen', payload: { key: 'personal', id: 1 } }); });
    expect(dash().slice(0, 3)).toEqual(['Gifts', 'Rent', 'Emergency']);
    drop([3, 5, 1, 2, 4]);
    expect(dash().slice(0, 3)).toEqual(['Emergency', 'Gifts', 'Rent']);
  });
});
