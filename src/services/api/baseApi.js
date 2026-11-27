import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { REHYDRATE } from 'redux-persist';
import { Config } from '../../utils/config';
import { selectToken } from '../../reducers/auth';
import { getRefreshToken } from '../storage/secure';

// THE auth seam: the only place a token is attached to a request (ADR-001).
// `timeout` is load-bearing for the ADR-019 boot gate, not just hygiene: that gate releases on data OR
// on a FETCH_ERROR/TIMEOUT_ERROR, so a socket that connects and then never answers (captive portal,
// half-open connection) would otherwise leave it spinning forever with no error to react to.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: Config.API_URL,
  timeout: 20000,
  prepareHeaders: (headers, { getState }) => {
    const token = selectToken(getState());
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const AUTH_ENDPOINTS = ['login', 'refresh'];
// step-up shares a 401 for a wrong password and an expired bearer: it tries the shared refresh (so an expired
// token recovers) but a final 401 is just "wrong password" — never a logout.
const NO_LOGOUT_ENDPOINTS = ['stepUp'];

// Single shared in-flight refresh: N concurrent 401s await ONE POST /auth/refresh (the backend rotates
// the refresh token, so a second concurrent call would trip reuse detection and kill the session).
let refreshPromise = null;

// Resolves 'ok' | 'invalid' (no stored token, or the backend rejected it: 400/401 -> session over) |
// 'transient' (network error, timeout, 5xx: the session may still be fine, so never log out on these).
const refreshSession = (api, extraOptions) => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return 'invalid';
      const res = await rawBaseQuery(
        { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
        api,
        extraOptions,
      );
      if (res.error) return [400, 401].includes(res.error.status) ? 'invalid' : 'transient';
      if (!res.data?.token) return 'transient';
      const { saveSession } = require('./session');
      await saveSession(res.data, api.dispatch);
      return 'ok';
    })()
      .catch(() => 'transient')
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const shapeError = (result) => {
  const data = result.error.data;
  result.error.message =
    (data && (data.error || data.message)) || `Request failed (${result.error.status})`;
};

// Normalize the backend's `{ error }` body (PRD §4) into error.message for the UI. A 401 on any call but
// login/refresh first tries ONE shared token refresh and retries the request once; only a failed refresh
// (or a second 401) is "session over" — the teardown lives in hardLogout so this path and the manual
// logout cannot drift apart again (they did once: this one forgot resetContext). (ADR-011/019)
const baseQueryWithErrorShape = async (args, api, extraOptions) => {
  const sentToken = selectToken(api.getState());
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) {
    shapeError(result);

    if (result.error.status === 401 && !AUTH_ENDPOINTS.includes(api.endpoint)) {
      let session = false;
      let outcome = 'ok';
      // A request sent with a token that another call has since refreshed just retries with the new one;
      // refreshing again would reuse the rotated refresh token and revoke the session.
      const alreadyRefreshed = selectToken(api.getState()) !== sentToken;
      if (!alreadyRefreshed) outcome = await refreshSession(api, extraOptions);
      if (outcome === 'transient') return result; // stay logged in; the caller can retry later
      if (outcome === 'ok') {
        result = await rawBaseQuery(args, api, extraOptions);
        if (!result.error) return result;
        shapeError(result);
        session = result.error.status !== 401;
      }
      if (!session && !NO_LOGOUT_ENDPOINTS.includes(api.endpoint)) {
        // Required lazily, not imported: hardLogout reaches back for baseApi.util.resetApiState(), and a
        // top-level import on either side leaves one of them undefined at module-init time.
        const { hardLogout } = require('./hardLogout');
        await hardLogout(api.dispatch);
      }
    }
  }
  return result;
};

// Empty base API; each entity file adds its endpoints via injectEndpoints (ADR-005).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithErrorShape,
  tagTypes: ['Balance', 'Transaction', 'Vault', 'VaultHistory', 'Category', 'Team', 'TeamMember', 'ShoppingList', 'Event', 'Loan', 'LoanHistory', 'Card', 'Transfer'],
  // Show persisted/cached data immediately, then revalidate (ADR-007).
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: true,
  // Let RTK Query pick up the redux-persist'd cache on cold start.
  extractRehydrationInfo(action, { reducerPath }) {
    if (action.type === REHYDRATE) {
      return action.payload?.[reducerPath];
    }
  },
  endpoints: () => ({}),
});
