import { baseApi } from './baseApi';

// GET /balance — the dashboard's primary call. Returns { total, available, vaults[], currency }. (PRD §4.1)
export const balanceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBalance: build.query({
      query: () => '/balance',
      providesTags: ['Balance'],
    }),
  }),
});

export const { useGetBalanceQuery } = balanceApi;
