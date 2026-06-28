import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// GET /balance — the dashboard's primary call. Returns { total, available, vaults[], currency }. The
// optional team_id arg scopes it to a team and is part of the cache key. (PRD §4.1, ADR-011)
export const balanceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBalance: build.query({
      // arg: team_id (null/undefined = personal)
      query: (team_id) => withTeam('/balance', team_id),
      providesTags: ['Balance'],
    }),
  }),
});

export const { useGetBalanceQuery } = balanceApi;
