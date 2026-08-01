import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { REHYDRATE } from 'redux-persist';
import { Config } from '../../utils/config';
import { selectToken } from '../../reducers/auth';

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

// Normalize the backend's `{ error }` body (PRD §4) into error.message for the UI, and treat a 401 on
// any call but `login` as "session over" — the teardown itself lives in hardLogout so this path and the
// manual logout cannot drift apart again (they did once: this one forgot resetContext). (ADR-011/019)
const baseQueryWithErrorShape = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) {
    const data = result.error.data;
    result.error.message =
      (data && (data.error || data.message)) || `Request failed (${result.error.status})`;

    if (result.error.status === 401 && api.endpoint !== 'login') {
      // Required lazily, not imported: hardLogout reaches back for baseApi.util.resetApiState(), and a
      // top-level import on either side leaves one of them undefined at module-init time.
      const { hardLogout } = require('./hardLogout');
      await hardLogout(api.dispatch);
    }
  }
  return result;
};

// Empty base API; each entity file adds its endpoints via injectEndpoints (ADR-005).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithErrorShape,
  tagTypes: ['Balance', 'Transaction', 'Vault', 'VaultHistory', 'Category', 'Team', 'TeamMember', 'ShoppingList', 'Event', 'Loan', 'LoanHistory'],
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
