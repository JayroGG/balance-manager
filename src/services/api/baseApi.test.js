// Give fetchBaseQuery an absolute baseUrl so `new Request(url)` is valid under Node's fetch.
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));

// The 401 handler calls clearToken() (secure-store) — mock it so it resolves and is assertable.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

import * as SecureStore from 'expo-secure-store';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { balanceApi } from './balance';
import { transactionsApi } from './transactions';
import { authApi } from './auth';
import authReducer from '../../reducers/auth';

// Build a fresh store per test, mirroring src/store/index.js (minus redux-persist). (ADR-005)
const makeStore = (auth) =>
  configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer }),
    preloadedState: { auth: { user: null, bootstrapped: true, ...auth } },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    // Disable RTK's autoBatch enhancer: its default 'raf' flush schedules a requestAnimationFrame that
    // the RN preset defers and fires after teardown ("...environment after it has been torn down").
    enhancers: (gde) => gde({ autoBatch: false }),
  });

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let store;
const lastRequest = () => global.fetch.mock.calls[0][0];

beforeEach(() => {
  // global.fetch is installed in jest.setup.js with a stable identity — only mutate it here.
  // mockImplementation (not mockResolvedValue): a Response body reads once, so each call needs a fresh one.
  global.fetch.mockReset();
  global.fetch.mockImplementation(() => Promise.resolve(jsonResponse({ total: 0 })));
  SecureStore.deleteItemAsync.mockClear();
});
afterEach(async () => {
  store?.dispatch(baseApi.util.resetApiState()); // drop subscriptions/cache
  await new Promise((r) => setTimeout(r, 0)); // let deferred (rAF) callbacks run before teardown
});

describe('prepareHeaders — the auth token seam (ADR-001/005)', () => {
  it('injects the bypass placeholder token when bypass is on and no real token', async () => {
    store = makeStore({ token: null, bypass: true });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    const request = lastRequest();
    expect(request.headers.get('Authorization')).toBe('Bearer bypass-placeholder-token');
    expect(request.url).toContain('/balance');
  });

  it('injects a real token when present', async () => {
    store = makeStore({ token: 'realtoken', bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(lastRequest().headers.get('Authorization')).toBe('Bearer realtoken');
  });

  it('sends no Authorization header when there is no token and no bypass', async () => {
    store = makeStore({ token: null, bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(lastRequest().headers.get('Authorization')).toBeNull();
  });
});

describe('error-shape transform — backend { error } → error.message (ADR-005)', () => {
  it('surfaces the backend error message', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(jsonResponse({ error: 'Insufficient funds' }, 400)));
    store = makeStore({ token: null, bypass: true });

    const result = await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(result.error.message).toBe('Insufficient funds');
  });

  it('falls back to "Request failed (<status>)" when the body has no message', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(jsonResponse({}, 500)));
    store = makeStore({ token: null, bypass: true });

    const result = await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(result.error.message).toBe('Request failed (500)');
  });
});

describe('401 auto-logout — session over (ADR-011)', () => {
  it('clears auth + token + cache on a 401 from a non-login call', async () => {
    global.fetch
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ total: 99 })))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401)));
    store = makeStore({ token: 'realtoken', bypass: false });

    // Prime a cached query, then a second call 401s.
    const sub = store.dispatch(balanceApi.endpoints.getBalance.initiate());
    await sub;
    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(0);

    await store.dispatch(transactionsApi.endpoints.getTransactions.initiate({}));

    expect(store.getState().auth.token).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(store.getState().api.queries).toEqual({}); // resetApiState dropped the cache
    sub.unsubscribe();
  });

  it('does NOT clear the session on a 401 from /auth/login (bad password stays inline)', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ error: 'Invalid credentials' }, 401)),
    );
    store = makeStore({ token: 'realtoken', bypass: false });

    const result = await store.dispatch(
      authApi.endpoints.login.initiate({ email: 'a@b.co', password: 'wrong' }),
    );

    expect(result.error.message).toBe('Invalid credentials');
    expect(store.getState().auth.token).toBe('realtoken');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
