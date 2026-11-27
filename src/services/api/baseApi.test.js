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
import { categoriesApi } from './categories';
import { authApi } from './auth';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import activityReducer from '../../reducers/activity';

// Build a fresh store per test, mirroring src/store/index.js (minus redux-persist). (ADR-005)
const makeStore = (auth, context) =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      activity: activityReducer,
    }),
    preloadedState: {
      auth: { user: null, bootstrapped: true, ...auth },
      context: { activeTeamId: null, ...context },
    },
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

  it('resets the active team context (ADR-019 regression guard) on a 401 from a non-login call', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401)));
    store = makeStore({ token: 'realtoken', bypass: false }, { activeTeamId: 5 });

    expect(store.getState().context.activeTeamId).toBe(5);

    await store.dispatch(transactionsApi.endpoints.getTransactions.initiate({}));

    // The bug this guards against: the 401 path forgot resetContext, so a stale activeTeamId (which
    // is redux-persist'd) survived a cold start and money rendered under the wrong team's chrome.
    expect(store.getState().context.activeTeamId).toBeNull();
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

describe('401 refresh — single shared refresh + one retry', () => {
  // A syntactically valid JWT (sub=7) so decodeUser works.
  const jwt = `h.${Buffer.from(JSON.stringify({ sub: '7', email: 'a@b.co' })).toString('base64')}.s`;
  const isRefresh = (req) => req.url.endsWith('/auth/refresh');
  const refreshCalls = () => global.fetch.mock.calls.filter(([r]) => isRefresh(r)).length;

  // 401 for any request carrying the old token; 200 once the new token is attached.
  const serve = (refreshResponse) =>
    global.fetch.mockImplementation((req) => {
      if (isRefresh(req)) return Promise.resolve(refreshResponse());
      const ok = req.headers.get('Authorization') === `Bearer ${jwt}`;
      const body = req.url.includes('/categories') ? [] : { total: 1 };
      return Promise.resolve(ok ? jsonResponse(body) : jsonResponse({ error: 'expired' }, 401));
    });

  beforeEach(() => {
    SecureStore.getItemAsync.mockImplementation(() => Promise.resolve('old-refresh'));
    SecureStore.setItemAsync.mockClear();
  });
  afterEach(() => {
    SecureStore.getItemAsync.mockImplementation(() => Promise.resolve(null));
  });

  it('2 concurrent 401s trigger exactly 1 refresh and both are retried', async () => {
    serve(() => jsonResponse({ token: jwt, refreshToken: 'new-refresh' }));
    store = makeStore({ token: 'old', bypass: false });

    const [a, b] = await Promise.all([
      store.dispatch(balanceApi.endpoints.getBalance.initiate()),
      store.dispatch(categoriesApi.endpoints.getCategories.initiate()),
    ]);

    expect(refreshCalls()).toBe(1);
    expect(a.data).toEqual({ total: 1 });
    expect(b.data).toEqual([]);
    expect(store.getState().auth.token).toBe(jwt);
    expect(store.getState().auth.user).toEqual({ id: '7', email: 'a@b.co', isAdmin: false });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_refresh_token', 'new-refresh');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', jwt);
  });

  it('a 401 after another refresh already completed retries with the new token, no second refresh', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    global.fetch.mockImplementation(async (req) => {
      if (isRefresh(req)) return jsonResponse({ token: jwt, refreshToken: 'new-refresh' });
      if (req.headers.get('Authorization') === `Bearer ${jwt}`)
        return jsonResponse(req.url.includes('/categories') ? [] : { total: 1 });
      if (req.url.includes('/balance')) await gate; // slow request sent with the old token
      return jsonResponse({ error: 'expired' }, 401);
    });
    store = makeStore({ token: 'old', bypass: false });

    const slow = store.dispatch(balanceApi.endpoints.getBalance.initiate());
    await store.dispatch(categoriesApi.endpoints.getCategories.initiate()); // 401 -> refresh completes
    release();
    const r = await slow;

    expect(refreshCalls()).toBe(1);
    expect(r.data).toEqual({ total: 1 });
    expect(store.getState().auth.token).toBe(jwt);
  });

  it('a network error on refresh does NOT log out and returns the original 401', async () => {
    global.fetch.mockImplementation((req) =>
      isRefresh(req) ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve(jsonResponse({ error: 'expired' }, 401)),
    );
    store = makeStore({ token: 'old', bypass: false });

    const result = await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(result.error.status).toBe(401);
    expect(store.getState().auth.token).toBe('old');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('a 5xx on refresh does NOT log out', async () => {
    serve(() => jsonResponse({ error: 'boom' }, 503));
    store = makeStore({ token: 'old', bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(store.getState().auth.token).toBe('old');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('a failed refresh hard-logs-out', async () => {
    serve(() => jsonResponse({ error: 'revoked' }, 401));
    store = makeStore({ token: 'old', bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(store.getState().auth.token).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_refresh_token');
  });

  it('does not loop: a 401 after a successful refresh retries once, then logs out', async () => {
    global.fetch.mockImplementation((req) =>
      Promise.resolve(
        isRefresh(req)
          ? jsonResponse({ token: jwt, refreshToken: 'new-refresh' })
          : jsonResponse({ error: 'nope' }, 401),
      ),
    );
    store = makeStore({ token: 'old', bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(refreshCalls()).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(3); // original, refresh, one retry
    expect(store.getState().auth.token).toBeNull();
  });

  it('no stored refresh token -> hard logout without a refresh call', async () => {
    SecureStore.getItemAsync.mockImplementation(() => Promise.resolve(null));
    serve(() => jsonResponse({}));
    store = makeStore({ token: 'old', bypass: false });

    await store.dispatch(balanceApi.endpoints.getBalance.initiate());

    expect(refreshCalls()).toBe(0);
    expect(store.getState().auth.token).toBeNull();
  });

  it('a 401 from login or refresh is not refreshed', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(jsonResponse({ error: 'bad' }, 401)));
    store = makeStore({ token: 'old', bypass: false });

    await store.dispatch(authApi.endpoints.login.initiate({ email: 'a@b.co', password: 'x' }));
    await store.dispatch(authApi.endpoints.refresh.initiate({ refreshToken: 'r' }));

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(store.getState().auth.token).toBe('old');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
