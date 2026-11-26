jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
jest.mock('expo-haptics', () => ({}));
jest.mock('react-native-gesture-handler', () => ({ Gesture: {}, GestureDetector: ({ children }) => children }));
jest.mock('react-native-reanimated', () => ({ Easing: { out: (f) => f, cubic: 1 } }));

import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react-native';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../../services/api/baseApi';
import '../../services/api';
import { balanceApi } from '../../services/api/balance';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import vaultOrderReducer, { mergeOrder, saveOrder, orderKey } from '../../reducers/vaultOrder';
import { startVaultOrderSync } from '../../reducers/vaultOrder/sync';
import { useOrderedVaults } from './reorder';
import { moveItem, targetIndex } from '../../components/ui/SortableList';

const toIds = (l) => l.map((v) => v.id);
const vaults = [{ id: 1 }, { id: 2 }, { id: 3 }];
const res = (status) =>
  new Response(status === 204 ? null : '{"error":"x"}', { status, headers: { 'content-type': 'application/json' } });

const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      vaultOrder: vaultOrderReducer,
    }),
    preloadedState: { auth: { token: null, user: { id: 7 }, bypass: false, bootstrapped: true } },
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });

describe('reorder pure logic', () => {
  it('moves an item and builds the ids payload', () => {
    expect(toIds(moveItem(vaults, 0, 2))).toEqual([2, 3, 1]);
    expect(toIds(moveItem(vaults, 2, 0))).toEqual([3, 1, 2]);
    expect(moveItem(vaults, 1, 1)).toBe(vaults);
  });
  it('targetIndex follows the dragged centre, vertical only', () => {
    expect(targetIndex([100, 100, 100], 0, 100)).toBe(1);
    expect(targetIndex([100, 100, 100], 2, -250)).toBe(0);
    expect(targetIndex([100, 100, 100], 1, 10)).toBe(1);
  });
  it('mergeOrder: server wins when not pending; pending local first, missing go last', () => {
    expect(mergeOrder(vaults, { pending: false, ids: [3, 2, 1] })).toBe(vaults);
    const merged = mergeOrder([...vaults, { id: 4 }], { pending: true, ids: [3, 1, 99] });
    expect(toIds(merged)).toEqual([3, 1, 2, 4]);
  });
});

describe('useOrderedVaults (local-first)', () => {
  it('saves a drop locally at once, pending, no network', () => {
    global.fetch.mockReset();
    const store = makeStore();
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useOrderedVaults(vaults), { wrapper });
    act(() => result.current.onReorder(['2', '3', '1'], [{ id: 2 }, { id: 3 }, { id: 1 }]));
    expect(toIds(result.current.ordered)).toEqual([2, 3, 1]);
    expect(store.getState().vaultOrder.byKey[orderKey(7, null)]).toMatchObject({ ids: [2, 3, 1], pending: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('server order wins and local copy refreshes when nothing is pending', () => {
    const store = makeStore();
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useOrderedVaults(vaults), { wrapper });
    expect(toIds(result.current.ordered)).toEqual([1, 2, 3]);
    expect(store.getState().vaultOrder.byKey[orderKey(7, null)]).toEqual(
      expect.objectContaining({ ids: [1, 2, 3], pending: false }),
    );
  });
});

describe('background sync', () => {
  let stop;
  let appStateCb;
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch.mockReset();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb) => {
      appStateCb = cb;
      return { remove: () => {} };
    });
  });
  afterEach(() => {
    stop?.();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const seed = (store, ids = [1, 2, 3], teamId = null) =>
    store.dispatch(balanceApi.util.upsertQueryData('getBalance', teamId, { vaults: ids.map((id) => ({ id })) }));
  const drop = (store, ids, teamId = null) => store.dispatch(saveOrder({ userId: 7, teamId, ids }));
  const puts = () => global.fetch.mock.calls.map((c) => c[0]).filter((r) => r.method === 'PUT');

  const setup = (teamId = null, ids = [1, 2, 3]) => {
    const store = makeStore();
    seed(store, ids, teamId);
    stop = startVaultOrderSync(store, { delay: 1500 });
    return store;
  };
  const pendingOf = (store, teamId = null) => store.getState().vaultOrder.byKey[orderKey(7, teamId)].pending;

  it('debounces after the last drop, PUTs once, clears pending', async () => {
    global.fetch.mockResolvedValue(res(204));
    const store = setup();
    drop(store, [2, 1, 3]);
    await act(async () => jest.advanceTimersByTime(1000));
    drop(store, [3, 2, 1]);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(puts()).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(600));
    expect(puts()).toHaveLength(1);
    expect(await puts()[0].json()).toEqual({ ids: [3, 2, 1] });
    expect(pendingOf(store)).toBe(false);
  });

  it('failure stays pending silently and retries on foreground', async () => {
    global.fetch.mockResolvedValueOnce(res(500)).mockResolvedValue(res(204));
    const store = setup(5);
    drop(store, [2, 1, 3], 5);
    await act(async () => jest.advanceTimersByTime(1600));
    expect(puts()).toHaveLength(1);
    expect(puts()[0].url).toContain('/vaults/order?team_id=5');
    expect(pendingOf(store, 5)).toBe(true);
    await act(async () => appStateCb('active'));
    expect(puts()).toHaveLength(2);
    expect(pendingOf(store, 5)).toBe(false);
  });

  it('retries after the next successful /balance refetch (timer was reset)', async () => {
    global.fetch.mockResolvedValueOnce(res(500)).mockResolvedValue(res(204));
    const store = setup();
    drop(store, [2, 1, 3]);
    await act(async () => jest.advanceTimersByTime(1600));
    expect(puts()).toHaveLength(1);
    await act(async () => jest.advanceTimersByTime(50));
    await act(async () => {
      seed(store);
    });
    expect(puts()).toHaveLength(2);
    expect(pendingOf(store)).toBe(false);
  });

  it('a drop during an in-flight PUT is flushed after it resolves', async () => {
    let release;
    global.fetch.mockImplementationOnce(() => new Promise((r) => (release = () => r(res(204)))));
    global.fetch.mockResolvedValue(res(204));
    const store = setup();
    drop(store, [2, 1, 3]);
    await act(async () => jest.advanceTimersByTime(1600));
    expect(puts()).toHaveLength(1);
    drop(store, [3, 2, 1]); // while the first PUT is in flight
    await act(async () => release());
    await act(async () => jest.advanceTimersByTime(10));
    expect(puts()).toHaveLength(2);
    expect(await puts()[1].json()).toEqual({ ids: [3, 2, 1] });
    expect(pendingOf(store)).toBe(false);
  });

  it('does not refetch on success: patches the cache so the UI does not jump', async () => {
    global.fetch.mockResolvedValue(res(204));
    const store = setup();
    drop(store, [3, 1, 2]);
    await act(async () => jest.advanceTimersByTime(1600));
    expect(global.fetch.mock.calls.filter((c) => c[0].method === 'GET')).toHaveLength(0);
    expect(balanceApi.endpoints.getBalance.select(null)(store.getState()).data.vaults.map((v) => v.id)).toEqual([3, 1, 2]);
  });

  it('only PUTs ids of vaults that still exist', async () => {
    global.fetch.mockResolvedValue(res(204));
    const store = setup(null, [1, 3]);
    drop(store, [2, 3, 1]); // 2 was deleted
    await act(async () => jest.advanceTimersByTime(1600));
    expect(await puts()[0].json()).toEqual({ ids: [3, 1] });
    expect(pendingOf(store)).toBe(false);
  });
});
