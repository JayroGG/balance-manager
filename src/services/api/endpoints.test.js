// Absolute baseUrl so `new Request(url)` is valid under Node's fetch.
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { balanceApi } from './balance';
import { transactionsApi } from './transactions';
import { vaultsApi } from './vaults';
import authReducer from '../../reducers/auth';

const makeStore = () =>
  configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer }),
    preloadedState: { auth: { token: null, user: null, bypass: true, bootstrapped: true } },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    // Disable RTK's autoBatch enhancer (default 'raf' flush) — its requestAnimationFrame fires after
    // teardown under the RN jest preset. (See baseApi.test.js)
    enhancers: (gde) => gde({ autoBatch: false }),
  });

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchedUrls = () => global.fetch.mock.calls.map((c) => c[0].url);
const balanceCalls = () => fetchedUrls().filter((u) => u.includes('/balance')).length;

// Invalidation-triggered refetch is async; poll until it lands (or give up after ~1s).
const waitForBalanceCalls = async (n) => {
  for (let i = 0; i < 50; i++) {
    if (balanceCalls() >= n) return;
    await new Promise((r) => setTimeout(r, 20));
  }
};

let store;

beforeEach(() => {
  global.fetch.mockReset();
  // mockImplementation (not mockResolvedValue): a Response body reads once, so every call needs a fresh one.
  global.fetch.mockImplementation(() => Promise.resolve(jsonResponse([])));
});
afterEach(async () => {
  store?.dispatch(baseApi.util.resetApiState());
  await new Promise((r) => setTimeout(r, 0)); // let deferred (rAF) callbacks run before teardown
});

describe('getTransactions — filter → query string', () => {
  it('serializes provided filters and drops empty values', async () => {
    store = makeStore();
    await store.dispatch(
      transactionsApi.endpoints.getTransactions.initiate({
        type: 'expense',
        category_id: 2,
        description: '',
      }),
    );
    const url = global.fetch.mock.calls[0][0].url;
    expect(url).toContain('type=expense');
    expect(url).toContain('category_id=2');
    expect(url).not.toContain('description');
  });

  it('hits /transactions with no query string when no filters are given', async () => {
    store = makeStore();
    await store.dispatch(transactionsApi.endpoints.getTransactions.initiate({}));
    const url = global.fetch.mock.calls[0][0].url;
    expect(url).toMatch(/\/transactions$/);
  });
});

describe('vault actions — amount-based allocate (ADR-009)', () => {
  it('POSTs { amount } to /vaults/:id/allocate', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ id: 3, name: 'Emergency', balance: 50, target: 500 })),
    );
    store = makeStore();

    await store.dispatch(vaultsApi.endpoints.allocateVault.initiate({ id: 3, amount: 50 }));

    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toContain('/vaults/3/allocate');
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ amount: 50 });
  });
});

describe("cache invalidation — money mutations invalidate 'Balance' (ADR-005/009)", () => {
  it('refetches /balance after a transaction mutation', async () => {
    store = makeStore();

    // Prime the balance query (keep the subscription alive so invalidation can refetch it).
    const balanceSub = store.dispatch(balanceApi.endpoints.getBalance.initiate());
    await balanceSub;
    expect(balanceCalls()).toBe(1);

    // A transaction mutation invalidates the Balance tag → the active query refetches.
    await store.dispatch(transactionsApi.endpoints.addTransaction.initiate({ type: 'income', amount: 10 }));
    await waitForBalanceCalls(2);

    expect(balanceCalls()).toBeGreaterThan(1);

    balanceSub.unsubscribe();
  });
});
