// Absolute baseUrl so `new Request(url)` is valid under Node's fetch.
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { authApi } from './auth';
import { teamsApi } from './teams';
import { balanceApi } from './balance';
import { transactionsApi } from './transactions';
import { vaultsApi } from './vaults';
import { categoriesApi } from './categories';
import { sourcesApi } from './sources';
import { capturesApi } from './captures';
import { transfersApi } from './transfers';
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

describe('auth + teams endpoints — URL building (ADR-011)', () => {
  it('POSTs credentials to /auth/login', async () => {
    store = makeStore();
    await store.dispatch(authApi.endpoints.login.initiate({ email: 'a@b.co', password: 'pw' }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/auth\/login$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ email: 'a@b.co', password: 'pw' });
  });

  it('POSTs to /auth/logout', async () => {
    store = makeStore();
    await store.dispatch(authApi.endpoints.logout.initiate());
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/auth\/logout$/);
    expect(request.method).toBe('POST');
  });

  it('GETs /teams', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.getTeams.initiate());
    expect(global.fetch.mock.calls[0][0].url).toMatch(/\/teams$/);
  });
});

describe('team management — :id-scoped URLs, no ?team_id= (ADR-012)', () => {
  it('POSTs { name } to /teams to create', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.createTeam.initiate({ name: 'Household' }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ name: 'Household' });
  });

  it('POSTs { name, color } when a color is chosen (ADR-013)', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.createTeam.initiate({ name: 'Design', color: '#7C3AED' }));
    await expect(global.fetch.mock.calls[0][0].clone().json()).resolves.toEqual({
      name: 'Design',
      color: '#7C3AED',
    });
  });

  it('PUTs a color-only body to /teams/:id (no name required — ADR-013)', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.updateTeam.initiate({ id: 7, color: '#DC2626' }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7$/);
    await expect(request.clone().json()).resolves.toEqual({ color: '#DC2626' });
  });

  it('PUTs { color: null } to clear a team color (ADR-013)', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.updateTeam.initiate({ id: 7, color: null }));
    await expect(global.fetch.mock.calls[0][0].clone().json()).resolves.toEqual({ color: null });
  });

  it('PUTs { name } to /teams/:id to rename', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.updateTeam.initiate({ id: 7, name: 'Trip' }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7$/);
    expect(request.method).toBe('PUT');
    await expect(request.clone().json()).resolves.toEqual({ name: 'Trip' });
  });

  it('DELETEs /teams/:id', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.deleteTeam.initiate({ id: 7 }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7$/);
    expect(request.method).toBe('DELETE');
  });

  it('GETs /teams/:id/members', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.getMembers.initiate(7));
    expect(global.fetch.mock.calls[0][0].url).toMatch(/\/teams\/7\/members$/);
  });

  it('POSTs { email, role } to /teams/:id/members', async () => {
    store = makeStore();
    await store.dispatch(
      teamsApi.endpoints.addMember.initiate({ id: 7, email: 'a@b.co', role: 'guest' }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7\/members$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ email: 'a@b.co', role: 'guest' });
  });

  it('omits role from the add-member body when not given (server defaults to member)', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.addMember.initiate({ id: 7, email: 'a@b.co' }));
    await expect(global.fetch.mock.calls[0][0].clone().json()).resolves.toEqual({ email: 'a@b.co' });
  });

  it('PUTs { role } to /teams/:id/members/:userId to change a role', async () => {
    store = makeStore();
    await store.dispatch(
      teamsApi.endpoints.updateMemberRole.initiate({ id: 7, userId: 3, role: 'owner' }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7\/members\/3$/);
    expect(request.method).toBe('PUT');
    await expect(request.clone().json()).resolves.toEqual({ role: 'owner' });
  });

  it('DELETEs /teams/:id/members/:userId to remove', async () => {
    store = makeStore();
    await store.dispatch(teamsApi.endpoints.removeMember.initiate({ id: 7, userId: 3 }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/teams\/7\/members\/3$/);
    expect(request.method).toBe('DELETE');
  });
});

describe('team context — ?team_id= on queries, never in the body (ADR-011)', () => {
  it('appends team_id to GET /balance, /vaults, /categories', async () => {
    store = makeStore();
    await store.dispatch(balanceApi.endpoints.getBalance.initiate(5));
    await store.dispatch(vaultsApi.endpoints.getVaults.initiate(5));
    await store.dispatch(categoriesApi.endpoints.getCategories.initiate(5));
    const urls = fetchedUrls();
    expect(urls.some((u) => /\/balance\?team_id=5$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/vaults\?team_id=5$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/categories\?team_id=5$/.test(u))).toBe(true);
  });

  it('merges team_id alongside existing transaction filters', async () => {
    store = makeStore();
    await store.dispatch(
      transactionsApi.endpoints.getTransactions.initiate({ type: 'expense', team_id: 5 }),
    );
    const url = global.fetch.mock.calls[0][0].url;
    expect(url).toContain('type=expense');
    expect(url).toContain('team_id=5');
  });

  it('omits team_id entirely in personal context (null)', async () => {
    store = makeStore();
    await store.dispatch(balanceApi.endpoints.getBalance.initiate(null));
    expect(global.fetch.mock.calls[0][0].url).not.toContain('team_id');
  });

  it('sends team_id in the URL but NOT the body on a write', async () => {
    store = makeStore();
    await store.dispatch(
      transactionsApi.endpoints.addTransaction.initiate({ type: 'income', amount: 10, team_id: 5 }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toContain('team_id=5');
    await expect(request.clone().json()).resolves.toEqual({ type: 'income', amount: 10 });
  });

  it('strips team_id from a vault PUT body, keeping it in the URL', async () => {
    store = makeStore();
    await store.dispatch(
      vaultsApi.endpoints.updateVault.initiate({ id: 2, name: 'Trip', team_id: 5 }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toContain('/vaults/2?team_id=5');
    expect(request.method).toBe('PUT');
    await expect(request.clone().json()).resolves.toEqual({ name: 'Trip' });
  });
});

describe('auto-capture — sources/aliases URLs and bodies (ADR-014)', () => {
  it('GETs /payment-sources and POSTs a source with its routing rule in the body', async () => {
    store = makeStore();
    await store.dispatch(sourcesApi.endpoints.getSources.initiate());
    await store.dispatch(
      sourcesApi.endpoints.addSource.initiate({ name: 'Nu account', type: 'account', target_team_id: 4 }),
    );
    expect(fetchedUrls()[0]).toMatch(/\/payment-sources$/);
    const request = global.fetch.mock.calls[1][0];
    expect(request.url).toMatch(/\/payment-sources$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({
      name: 'Nu account', type: 'account', target_team_id: 4,
    });
  });

  it('PUTs updates to /payment-sources/:id with the id out of the body', async () => {
    store = makeStore();
    await store.dispatch(sourcesApi.endpoints.updateSource.initiate({ id: 3, target_team_id: null }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/payment-sources\/3$/);
    expect(request.method).toBe('PUT');
    await expect(request.clone().json()).resolves.toEqual({ target_team_id: null });
  });

  it('filters aliases by source and POSTs/DELETEs them', async () => {
    store = makeStore();
    await store.dispatch(sourcesApi.endpoints.getAliases.initiate({ source_id: 3 }));
    await store.dispatch(
      sourcesApi.endpoints.addAlias.initiate({ source_id: 3, channel: 'google_wallet', match_kind: 'card_last4', value: '0347' }),
    );
    await store.dispatch(sourcesApi.endpoints.deleteAlias.initiate({ id: 9 }));
    // Tag invalidation interleaves refetches — assert presence, not call order.
    const requests = global.fetch.mock.calls.map((c) => c[0]);
    expect(requests.some((r) => /\/source-aliases\?source_id=3$/.test(r.url))).toBe(true);
    expect(requests.some((r) => /\/source-aliases$/.test(r.url) && r.method === 'POST')).toBe(true);
    expect(requests.some((r) => /\/source-aliases\/9$/.test(r.url) && r.method === 'DELETE')).toBe(true);
  });
});

describe('auto-capture — review inbox actions (ADR-014)', () => {
  it('reads the inbox via ?status=pending', async () => {
    store = makeStore();
    await store.dispatch(capturesApi.endpoints.getCaptures.initiate({ status: 'pending' }));
    expect(fetchedUrls()[0]).toMatch(/\/captures\?status=pending$/);
  });

  it('POSTs confirm with source and overrides in the body, id in the path', async () => {
    store = makeStore();
    await store.dispatch(
      capturesApi.endpoints.confirmCapture.initiate({ id: 12, source_id: 3, category_id: 7 }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/captures\/12\/confirm$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ source_id: 3, category_id: 7 });
  });

  it('POSTs discard with no body fields', async () => {
    store = makeStore();
    await store.dispatch(capturesApi.endpoints.discardCapture.initiate({ id: 12 }));
    expect(fetchedUrls()[0]).toMatch(/\/captures\/12\/discard$/);
  });
});

describe('auto-capture — transfers (ADR-014)', () => {
  it('POSTs the two contexts in the body (the deliberate team_id-in-body exception)', async () => {
    store = makeStore();
    await store.dispatch(
      transfersApi.endpoints.addTransfer.initiate({ amount: 300, to_team_id: 4, description: 'capital' }),
    );
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/transfers$/);
    expect(request.method).toBe('POST');
    await expect(request.clone().json()).resolves.toEqual({ amount: 300, to_team_id: 4, description: 'capital' });
  });

  it('DELETEs /transfers/:group_id', async () => {
    store = makeStore();
    await store.dispatch(transfersApi.endpoints.deleteTransfer.initiate({ group_id: 'abc-123' }));
    const request = global.fetch.mock.calls[0][0];
    expect(request.url).toMatch(/\/transfers\/abc-123$/);
    expect(request.method).toBe('DELETE');
  });

  it('refetches transactions and balance after a transfer (both ends stay consistent)', async () => {
    store = makeStore();
    const balanceSub = store.dispatch(balanceApi.endpoints.getBalance.initiate());
    await balanceSub;
    expect(balanceCalls()).toBe(1);

    await store.dispatch(transfersApi.endpoints.addTransfer.initiate({ amount: 10, to_team_id: 4 }));
    await waitForBalanceCalls(2);
    expect(balanceCalls()).toBeGreaterThan(1);

    balanceSub.unsubscribe();
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
