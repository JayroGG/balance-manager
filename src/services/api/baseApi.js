import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { REHYDRATE } from 'redux-persist';
import { Config } from '../../utils/config';
import { selectToken } from '../../reducers/auth';

// THE auth seam: the only place a token is attached to a request (ADR-001).
const rawBaseQuery = fetchBaseQuery({
  baseUrl: Config.API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = selectToken(getState());
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Normalize the backend's `{ error }` body (PRD §4) into error.message for the UI.
const baseQueryWithErrorShape = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) {
    const data = result.error.data;
    result.error.message =
      (data && (data.error || data.message)) || `Request failed (${result.error.status})`;
  }
  return result;
};

// Empty base API; each entity file adds its endpoints via injectEndpoints (ADR-005).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithErrorShape,
  tagTypes: ['Balance', 'Transaction', 'Vault', 'VaultHistory', 'Category'],
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
