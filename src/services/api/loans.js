import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /loans — CRUD + history + lend/repay. Loan names/balances surface in GET /balance `loans[]`, so every
// mutation invalidates Balance too. lend is bounded by `available` (400 if over), repay is bounded by the
// pending loan balance (400 if over) — both also post a `loan_id`-tagged journal row into /transactions
// (as does create with an `amount` or `pre_existing`), hence the Transaction list-tag invalidation. Every
// arg carries an optional team_id → URL `?team_id=` (never the body) and part of the cache key.
// (PRD §4.1, ADR-009 / ADR-011)
const LIST_TAG = { type: 'Loan', id: 'LIST' };
const TRANSACTION_LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const loansApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLoans: build.query({
      // arg: team_id (null/undefined = personal)
      query: (team_id) => withTeam('/loans', team_id),
      providesTags: (result) =>
        result ? [...result.map((l) => ({ type: 'Loan', id: l.id })), LIST_TAG] : [LIST_TAG],
    }),
    getLoan: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/loans/${id}`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'Loan', id }],
    }),
    getLoanHistory: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/loans/${id}/history`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'LoanHistory', id }],
    }),
    addLoan: build.mutation({
      // body: { name, amount?, pre_existing? } — pre_existing posts an opening income, amount posts a journal row.
      query: ({ team_id, ...body }) => ({ url: withTeam('/loans', team_id), method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance', TRANSACTION_LIST_TAG],
    }),
    updateLoan: build.mutation({
      // body: { name } only
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/loans/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Loan', id }, LIST_TAG, 'Balance'],
    }),
    deleteLoan: build.mutation({
      query: ({ id, team_id }) => ({ url: withTeam(`/loans/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Loan', id }, LIST_TAG, 'Balance'],
    }),
    lendLoan: build.mutation({
      // arg: { id, amount, team_id? } — moves spendable → loan (decimal). Bounded by `available` (400 if over).
      query: ({ id, amount, team_id }) => ({
        url: withTeam(`/loans/${id}/lend`, team_id),
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Loan', id },
        { type: 'LoanHistory', id },
        LIST_TAG,
        'Balance',
        TRANSACTION_LIST_TAG,
      ],
    }),
    repayLoan: build.mutation({
      // arg: { id, amount, team_id? } — moves loan → spendable (decimal). Bounded by the pending balance (400 if over).
      query: ({ id, amount, team_id }) => ({
        url: withTeam(`/loans/${id}/repay`, team_id),
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Loan', id },
        { type: 'LoanHistory', id },
        LIST_TAG,
        'Balance',
        TRANSACTION_LIST_TAG,
      ],
    }),
  }),
});

export const {
  useGetLoansQuery,
  useGetLoanQuery,
  useGetLoanHistoryQuery,
  useAddLoanMutation,
  useUpdateLoanMutation,
  useDeleteLoanMutation,
  useLendLoanMutation,
  useRepayLoanMutation,
} = loansApi;
