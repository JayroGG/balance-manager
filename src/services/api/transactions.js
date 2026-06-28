import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /transactions — a pure ledger: CRUD with optional filters (type, category_id). Soft-delete → 204/404.
// Money is decimal & positive; `type` carries the sign. Transactions no longer tag vaults, but income/
// expense move total & available, so mutations invalidate Balance. Every arg carries an optional team_id
// → URL `?team_id=` (never the body) and part of the cache key. (PRD §4.1, ADR-009 / ADR-011)
const LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransactions: build.query({
      // arg: { type?, category_id?, team_id? }
      query: ({ team_id, ...filters } = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.append(k, v);
        });
        const qs = params.toString();
        return withTeam(`/transactions${qs ? `?${qs}` : ''}`, team_id);
      },
      providesTags: (result) =>
        result
          ? [...result.map((t) => ({ type: 'Transaction', id: t.id })), LIST_TAG]
          : [LIST_TAG],
    }),
    getTransaction: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/transactions/${id}`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'Transaction', id }],
    }),
    addTransaction: build.mutation({
      query: ({ team_id, ...body }) => ({ url: withTeam('/transactions', team_id), method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance'],
    }),
    updateTransaction: build.mutation({
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/transactions/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance'],
    }),
    deleteTransaction: build.mutation({
      query: ({ id, team_id }) => ({ url: withTeam(`/transactions/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance'],
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useGetTransactionQuery,
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} = transactionsApi;
