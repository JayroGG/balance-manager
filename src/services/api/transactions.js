import { baseApi } from './baseApi';

// /transactions — CRUD with optional filters (type, vault_id, category_id). Soft-delete → 204/404.
// Money is decimal & positive; `type` carries the sign. Mutations touch balances, so we also
// invalidate Balance + Vault. (PRD §4.1, ADR-005)
const LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransactions: build.query({
      // arg: { type?, vault_id?, category_id? }
      query: (filters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.append(k, v);
        });
        const qs = params.toString();
        return `/transactions${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [...result.map((t) => ({ type: 'Transaction', id: t.id })), LIST_TAG]
          : [LIST_TAG],
    }),
    getTransaction: build.query({
      query: (id) => `/transactions/${id}`,
      providesTags: (r, e, id) => [{ type: 'Transaction', id }],
    }),
    addTransaction: build.mutation({
      query: (body) => ({ url: '/transactions', method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance', 'Vault'],
    }),
    updateTransaction: build.mutation({
      query: ({ id, ...body }) => ({ url: `/transactions/${id}`, method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance', 'Vault'],
    }),
    deleteTransaction: build.mutation({
      query: (id) => ({ url: `/transactions/${id}`, method: 'DELETE' }),
      invalidatesTags: (r, e, id) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance', 'Vault'],
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
