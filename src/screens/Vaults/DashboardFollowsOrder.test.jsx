jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }), Link: ({ children }) => children }));
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
    useAnimatedStyle: (f) => require('../../test-utils/visualOrder').lazyStyle(f),
    withSpring: (v) => v,
    withTiming: (v) => v,
    Easing: { out: (f) => f, cubic: 1 },
  };
});

import { useState } from 'react';
import { visualOrder } from '../../test-utils/visualOrder';
import { AppState, View } from 'react-native';
import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderWithStore, screen } from '../../test-utils/renderWithStore';
import { baseApi } from '../../services/api/baseApi';
import '../../services/api';
import { useGetBalanceQuery } from '../../services/api/balance';
import { startVaultOrderSync } from '../../reducers/vaultOrder/sync';
import SortableList from '../../components/ui/SortableList';
import Dashboard from '../Dashboard';
import { useOrderedVaults } from './reorder';

const json = (body, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const bal = (ids) => ({
  currency: 'USD', total: 100, available: 50, lent: 0,
  vaults: ids.map((id) => ({ id, name: `V${id}`, balance: 10, target: 0 })),
});

function VaultsScreen() {
  const { data } = useGetBalanceQuery(null);
  const { ordered, onReorder } = useOrderedVaults(data?.vaults);
  if (!data) return null;
  return (
    <SortableList data={ordered} keyExtractor={(v) => String(v.id)} onReorder={onReorder}
      renderItem={({ item }) => <Text testID="row">{`#${item.name}`}</Text>} />
  );
}

const dash = () => screen.queryAllByText(/^V\d$/).map((n) => n.props.children);
let rr;
const measure = () =>
  rr.UNSAFE_getAllByType(View).filter((v) => v.props.onLayout).forEach((v) => v.props.onLayout({ persist() {}, nativeEvent: { layout: { height: 100 } } }));

describe('Dashboard top-3 follows every drop (both tabs mounted)', () => {
  let stop, server;
  beforeEach(() => {
    jest.useFakeTimers();
    mockPans.length = 0;
    server = [1, 2, 3, 4];
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove() {} });
    global.fetch.mockReset();
    global.fetch.mockImplementation((req) => {
      if (req.method === 'PUT') return Promise.resolve(json(null, 204));
      if (req.url.includes('/balance')) return Promise.resolve(json(bal(server)));
      return Promise.resolve(json([]));
    });
  });
  afterEach(() => { stop?.(); jest.useRealTimers(); jest.restoreAllMocks(); });

  // drag the row at `from` by `rows` slots (100dp each)
  const drag = (from, rows) => {
    // the latest-created pan per row index: rows are memoised, so mockPans[from] is stable
    const pan = mockPans[from];
    act(() => pan.onStart());
    act(() => pan.onUpdate({ translationY: rows * 100 }));
    act(() => pan.onFinalize({ translationY: rows * 100 }, true));
  };
  const refetch = (store) => act(async () => { await store.dispatch(baseApi.endpoints.getBalance.initiate(null, { forceRefetch: true })); });

  it('top-3 matches the local order right after drop #1, #2, #3 across sync + old/new refetches', async () => {
    const { store, ...r } = renderWithStore(<><VaultsScreen /><Dashboard /></>);
    rr = r;
    stop = startVaultOrderSync(store, { delay: 1500 });
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure());
    expect(dash()).toEqual(['V1', 'V2', 'V3']);

    drag(0, 1); // [2,1,3,4]
    expect(dash()).toEqual(['V2', 'V1', 'V3']);

    await act(async () => jest.advanceTimersByTime(1600)); // PUT #1 ok -> awaiting
    server = [1, 2, 3, 4];
    await refetch(store); // stale old-order refetch
    expect(dash()).toEqual(['V2', 'V1', 'V3']);

    act(() => measure());
    drag(3, -3); // [4,2,1,3]
    expect(dash()).toEqual(['V4', 'V2', 'V1']);

    await refetch(store); // old order refetch while #2 pending
    expect(dash()).toEqual(['V4', 'V2', 'V1']);
    await act(async () => jest.advanceTimersByTime(1600)); // PUT #2 ok
    server = [4, 2, 1, 3];
    await refetch(store);
    expect(dash()).toEqual(['V4', 'V2', 'V1']);

    act(() => measure());
    drag(1, 1); // [4,1,2,3]
    expect(dash()).toEqual(['V4', 'V1', 'V2']);
  });

  it('drop #2 while PUT #1 is in flight, then #1 resolves, refetches in between', async () => {
    const releases = [];
    global.fetch.mockImplementation((req) => {
      if (req.method === 'PUT') return new Promise((r) => releases.push(() => r(json(null, 204))));
      if (req.url.includes('/balance')) return Promise.resolve(json(bal(server)));
      return Promise.resolve(json([]));
    });
    const { store, ...r } = renderWithStore(<><VaultsScreen /><Dashboard /></>);
    rr = r;
    stop = startVaultOrderSync(store, { delay: 1500 });
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure());

    drag(0, 1); // [2,1,3,4]
    expect(dash()).toEqual(['V2', 'V1', 'V3']);
    await act(async () => jest.advanceTimersByTime(1600)); // PUT #1 in flight
    act(() => measure());
    drag(3, -3); // [4,2,1,3]
    expect(dash()).toEqual(['V4', 'V2', 'V1']);
    await act(async () => releases[0]()); // PUT #1 resolves (A), B still pending
    expect(dash()).toEqual(['V4', 'V2', 'V1']);
    await refetch(store); // old order
    expect(dash()).toEqual(['V4', 'V2', 'V1']);
    act(() => measure());
    drag(0, 1); // V1 (pan 0) from slot 2 -> [4,2,3,1]
    expect(dash()).toEqual(['V4', 'V2', 'V3']);
    await act(async () => jest.advanceTimersByTime(10));
    await act(async () => releases[1]?.());
    await act(async () => jest.advanceTimersByTime(10));
    await act(async () => releases[2]?.());
    await act(async () => jest.advanceTimersByTime(10));
    expect(dash()).toEqual(['V4', 'V2', 'V3']);
  });

  it('when the hold is released (60s timer -> releaseHold action) both flip Dashboard and Vaults list to the server order together', async () => {
    const { store, ...r } = renderWithStore(<><VaultsScreen /><Dashboard /></>);
    rr = r;
    stop = startVaultOrderSync(store, { delay: 1500 });
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure());
    drag(0, 1); // local [2,1,3,4]
    await act(async () => jest.advanceTimersByTime(1600)); // PUT ok -> awaiting
    server = [1, 2, 3, 4]; // the server list disagrees (e.g. changed elsewhere)
    await refetch(store);
    const rows = () => visualOrder(screen.getAllByTestId('row')).map((n) => n.props.children);
    await act(async () => jest.advanceTimersByTime(30000));
    expect(dash()).toEqual(['V2', 'V1', 'V3']); // < 60s: still local
    expect(rows()).toEqual(['#V2', '#V1', '#V3', '#V4']);
    await act(async () => jest.advanceTimersByTime(31000)); // > 60s
    expect(dash()).toEqual(['V1', 'V2', 'V3']);
    expect(rows()).toEqual(['#V1', '#V2', '#V3', '#V4']);
  });

  it('stale-selector symptom: awaiting + a refetch with ANOTHER order + no other dispatch -> both screens agree at every step', async () => {
    let setShow;
    function Tab() {
      const [show, s] = useState(true);
      setShow = s;
      return show ? <VaultsScreen /> : null;
    }
    const { store, ...r } = renderWithStore(<><Dashboard /><Tab /></>);
    rr = r;
    stop = startVaultOrderSync(store, { delay: 1500 });
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure());
    const rows = () => visualOrder(screen.queryAllByTestId('row')).map((n) => n.props.children);
    const agree = (dashExpect, rowsExpect) => {
      expect(dash()).toEqual(dashExpect);
      if (rowsExpect) expect(rows()).toEqual(rowsExpect);
    };
    drag(0, 1); // local [2,1,3,4]
    await act(async () => jest.advanceTimersByTime(1600)); // synced -> awaiting
    act(() => setShow(false)); // Vaults tab goes away ...
    server = [1, 2, 3, 4]; // ... a refetch lands with a different order, NOTHING else dispatches
    await refetch(store);
    agree(['V2', 'V1', 'V3']);
    act(() => setShow(true)); // Vaults tab mounts later than the Dashboard
    act(() => measure());
    agree(['V2', 'V1', 'V3'], ['#V2', '#V1', '#V3', '#V4']);
    await act(async () => jest.advanceTimersByTime(59000));
    agree(['V2', 'V1', 'V3'], ['#V2', '#V1', '#V3', '#V4']);
    await act(async () => jest.advanceTimersByTime(2000)); // 60s timer -> releaseHold, no other dispatch
    agree(['V1', 'V2', 'V3'], ['#V1', '#V2', '#V3', '#V4']);
  });

  it('a second sync re-arms a full 60s hold (the first timer is not reused)', async () => {
    const { store, ...r } = renderWithStore(<><VaultsScreen /><Dashboard /></>);
    rr = r;
    stop = startVaultOrderSync(store, { delay: 1500 });
    await act(async () => jest.advanceTimersByTime(10));
    act(() => measure());
    drag(0, 1); // [2,1,3,4]
    await act(async () => jest.advanceTimersByTime(1600)); // sync #1 -> awaiting (timer t0+~1.6s)
    await act(async () => jest.advanceTimersByTime(40000));
    act(() => measure());
    drag(3, -3); // [4,2,1,3]
    await act(async () => jest.advanceTimersByTime(1600)); // sync #2
    server = [1, 2, 3, 4];
    await refetch(store);
    await act(async () => jest.advanceTimersByTime(30000)); // 31.6s after sync #2 but >60s after sync #1
    expect(dash()).toEqual(['V4', 'V2', 'V1']);
    await act(async () => jest.advanceTimersByTime(31000));
    expect(dash()).toEqual(['V1', 'V2', 'V3']);
  });
});
