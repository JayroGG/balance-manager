// Give fetchBaseQuery an absolute baseUrl so `new Request(url)` is valid under Node's fetch.
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { balanceApi } from './balance';
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
