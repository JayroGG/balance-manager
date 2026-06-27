import { baseApi } from './baseApi';

// /transactions — a pure ledger: CRUD with optional filters (type, category_id). Soft-delete → 204/404.
// Money is decimal & positive; `type` carries the sign. Transactions no longer tag vaults, but income/
// expense move total & available, so mutations invalidate Balance. (PRD §4.1, ADR-009 / backend ADR-004)
const LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransactions: build.query({
      // arg: { type?, category_id? }
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
      invalidatesTags: [LIST_TAG, 'Balance'],
    }),
    updateTransaction: build.mutation({
      query: ({ id, ...body }) => ({ url: `/transactions/${id}`, method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance'],
    }),
    deleteTransaction: build.mutation({
      query: (id) => ({ url: `/transactions/${id}`, method: 'DELETE' }),
      invalidatesTags: (r, e, id) => [{ type: 'Transaction', id }, LIST_TAG, 'Balance'],
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
