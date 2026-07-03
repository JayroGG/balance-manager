import { baseApi } from './baseApi';

// /auth/tokens — ingest-scoped automation tokens (ADR-014): long-lived credentials for iOS
// Shortcuts / MacroDroid, valid ONLY for POST /captures. Personal (no team scoping, no RBAC).
// The secret is returned once at mint time and never again — the list shows metadata only.
export const tokensApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTokens: build.query({
      query: () => '/auth/tokens',
      providesTags: ['Token'],
    }),
    createToken: build.mutation({
      // arg: { name } → { id, name, token } — `token` is shown once, store it in the automation.
      query: ({ name }) => ({ url: '/auth/tokens', method: 'POST', body: { name } }),
      invalidatesTags: ['Token'],
    }),
    revokeToken: build.mutation({
      // Revocation is immediate: the automation's next POST /captures 401s.
      query: ({ id }) => ({ url: `/auth/tokens/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Token'],
    }),
  }),
});

export const { useGetTokensQuery, useCreateTokenMutation, useRevokeTokenMutation } = tokensApi;
