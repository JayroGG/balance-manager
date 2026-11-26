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
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const { useRef } = require('react');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v) => useRef({ value: v }).current,
    useAnimatedStyle: (f) => f(),
    withSpring: (v) => v,
    withTiming: (v) => v,
    Easing: { out: (f) => f, cubic: 1 },
  };
});

import { AppState, Text, View } from 'react-native';
import { Provider } from 'react-redux';
import { render, act } from '@testing-library/react-native';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../../services/api/baseApi';
import '../../services/api';
import { useGetBalanceQuery } from '../../services/api/balance';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import vaultOrderReducer from '../../reducers/vaultOrder';
import { startVaultOrderSync } from '../../reducers/vaultOrder/sync';
import SortableList from '../../components/ui/SortableList';
import { useOrderedVaults } from './reorder';

const json = (body, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const bal = (ids) => ({ currency: 'USD', total: 0, available: 0, vaults: ids.map((id) => ({ id, name: `V${id}`, balance: 1 })) });

function Harness() {
  const { data } = useGetBalanceQuery(null);
  const { ordered, onReorder } = useOrderedVaults(data?.vaults);
  if (!data) return null;
  return (
    <SortableList
      data={ordered}
      keyExtractor={(v) => String(v.id)}
      onReorder={onReorder}
      renderItem={({ item }) => <Text testID="row">{item.name}</Text>}
    />
  );
}

const names = (r) => r.getAllByTestId('row').map((n) => n.props.children);
const measure = (r) =>
  r.UNSAFE_getAllByType(View).filter((v) => v.props.onLayout).forEach((v) => v.props.onLayout({ nativeEvent: { layout: { height: 100 } } }));

describe('vault reorder end-to-end (gesture -> store -> sync -> refetch)', () => {
  let stop;
  let server; // order the fake BE returns for GET /balance
  let puts;
  beforeEach(() => {
    jest.useFakeTimers();
    mockPans.length = 0;
    puts = [];
    server = [1, 2, 3];
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove() {} });
    global.fetch.mockReset();
    global.fetch.mockImplementation((req) => {
      if (req.method === 'PUT') {
        puts.push(req);
        return Promise.resolve(json(null, 204));
      }
      return Promise.resolve(json(bal(server)));
    });
  });
  afterEach(() => {
    stop?.();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const setup = async () => {
    const store = configureStore({
      reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, context: contextReducer, vaultOrder: vaultOrderReducer }),
      preloadedState: { auth: { token: null, user: { id: 7 }, bypass: false, bootstrapped: true } },
      middleware: (g) => g().concat(baseApi.middleware),
      enhancers: (g) => g({ autoBatch: false }),
    });
    stop = startVaultOrderSync(store, { delay: 1500 });
    const r = render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    );
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure(r));
    return { store, r };
  };
  // drag row 0 down by one row (100dp)
  const dragFirstDown = () => {
    const pan = mockPans[0];
    act(() => pan.onStart());
    act(() => pan.onUpdate({ translationY: 60 }));
    act(() => pan.onUpdate({ translationY: 100 }));
    act(() => pan.onFinalize({ translationY: 100 }, true));
  };

  it('does not rebuild the pan gesture while dragging (re-renders per move)', async () => {
    const { r } = await setup();
    const before = mockPans.length;
    const pan = mockPans[0];
    act(() => pan.onStart());
    act(() => pan.onUpdate({ translationY: 60 }));
    act(() => pan.onUpdate({ translationY: 100 }));
    expect(mockPans.length).toBe(before);
    act(() => pan.onFinalize({ translationY: 100 }, true));
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
  });

  it('the dropped order sticks through the PUT and a refetch returning the NEW order', async () => {
    const { r, store } = await setup();
    dragFirstDown();
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
    await act(async () => jest.advanceTimersByTime(1600));
    expect(puts).toHaveLength(1);
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
    server = [2, 1, 3];
    await act(async () => {
      await store.dispatch(baseApi.endpoints.getBalance.initiate(null, { forceRefetch: true }));
    });
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
  });

  it('stays put while pending even if /balance refetches the OLD order', async () => {
    const { r, store } = await setup();
    global.fetch.mockImplementation(() => Promise.reject(new Error('offline'))); // PUT fails -> pending
    dragFirstDown();
    await act(async () => jest.advanceTimersByTime(1600));
    await act(async () => {
      global.fetch.mockImplementation(() => Promise.resolve(json(bal([1, 2, 3]))));
      await store.dispatch(baseApi.endpoints.getBalance.initiate(null, { forceRefetch: true }));
    });
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
  });

  it('a stale refetch (old order) landing AFTER the sync does not flip the list back', async () => {
    const { r, store } = await setup();
    dragFirstDown();
    await act(async () => jest.advanceTimersByTime(1600)); // PUT ok, pending cleared
    expect(puts).toHaveLength(1);
    await act(async () => {
      server = [1, 2, 3]; // response of a refetch that started before the PUT
      await store.dispatch(baseApi.endpoints.getBalance.initiate(null, { forceRefetch: true }));
    });
    expect(names(r)).toEqual(['V2', 'V1', 'V3']);
  });
});
