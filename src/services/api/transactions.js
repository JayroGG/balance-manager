import { baseApi } from './baseApi';
import { withTeam } from './teamParam';
import { withQuery } from './queryString';

// /transactions — a pure ledger: CRUD plus a server-side search/date/type list (paged). Soft-delete → 204/404.
// Money is decimal & positive; `type` carries the sign. Transactions no longer tag vaults, but income/
// expense move total & available, so mutations invalidate Balance. Every arg carries an optional team_id
// → URL `?team_id=` (never the body) and part of the cache key. (PRD §4.1, ADR-009 / ADR-011)
export const PAGE_SIZE = 30;
const LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Server-filtered, keyset-paged list (BE ADR-011 / FE ADR-021). Each page is
    // { items, next_cursor, totals } — `totals` cover the whole filtered set, so read them from page 1.
    // arg: { team_id?, q?, from?, to?, type?, loans?: 'only'|'exclude', sort?: 'asc'|'desc' }
    getTransactions: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
      },
      query: ({ queryArg: { team_id, ...filters } = {}, pageParam }) =>
        withTeam(withQuery('/transactions', { ...filters, limit: PAGE_SIZE, cursor: pageParam }), team_id),
      providesTags: (result) =>
        result
          ? [...result.pages.flatMap((p) => p.items.map((t) => ({ type: 'Transaction', id: t.id }))), LIST_TAG]
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
  useGetTransactionsInfiniteQuery,
  useGetTransactionQuery,
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} = transactionsApi;
