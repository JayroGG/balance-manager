import { baseApi } from './baseApi';

// /transfers — one atomic two-legged move of money between two contexts (expense in `from`, income in
// `to`, paired by transfer_group_id; legs are not individually editable). Deliberate exception to the
// "team_id never in a body" rule: the from/to contexts ARE the payload here, per the backend contract.
// Both ends' dashboards refresh via Transaction/Balance invalidation. (ADR-014)
export const transfersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    addTransfer: build.mutation({
      // arg: { amount, from_team_id?, to_team_id?, description? } — null/omitted end = personal.
      query: (body) => ({ url: '/transfers', method: 'POST', body }),
      invalidatesTags: ['Transaction', 'Balance'],
    }),
    deleteTransfer: build.mutation({
      // arg: { group_id } — soft-deletes both legs atomically.
      query: ({ group_id }) => ({ url: `/transfers/${group_id}`, method: 'DELETE' }),
      invalidatesTags: ['Transaction', 'Balance'],
    }),
  }),
});

export const { useAddTransferMutation, useDeleteTransferMutation } = transfersApi;
