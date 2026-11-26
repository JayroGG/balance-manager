import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /cards — CRUD + pay (BE ADR-014 / FE ADR-023). Every read and write response carries the computed
// figures { owed, statement_balance, current_period, last_cut, due_date, credit_limit }; nothing is stored
// on the card. A past `due_date` with `statement_balance > 0` is overdue (the BE does not roll it forward).
// Pay posts a `card_payment` transaction (cash out, not a spend) so it also invalidates Balance + the
// Transaction list. Charges are plain expenses with `card_id` (see transactions.js, which invalidates Card).
// Every arg carries an optional team_id → URL `?team_id=` (never the body) and part of the cache key.
const LIST_TAG = { type: 'Card', id: 'LIST' };
const TRANSACTION_LIST_TAG = { type: 'Transaction', id: 'LIST' };

export const cardsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCards: build.query({
      // arg: team_id (null/undefined = personal)
      query: (team_id) => withTeam('/cards', team_id),
      providesTags: (result) =>
        result ? [...result.map((c) => ({ type: 'Card', id: c.id })), LIST_TAG] : [LIST_TAG],
    }),
    getCard: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/cards/${id}`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'Card', id }],
    }),
    addCard: build.mutation({
      // body: { name, cut_day (1..31), due_day (1..31), credit_limit? }
      query: ({ team_id, ...body }) => ({ url: withTeam('/cards', team_id), method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance'],
    }),
    updateCard: build.mutation({
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/cards/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Card', id }, LIST_TAG, 'Balance'],
    }),
    deleteCard: build.mutation({
      // 400 while owed > 0
      query: ({ id, team_id }) => ({ url: withTeam(`/cards/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Card', id }, LIST_TAG, 'Balance', TRANSACTION_LIST_TAG],
    }),
    payCard: build.mutation({
      // arg: { id, amount, occurred_at?, team_id? } — 400 if amount <= 0 or > owed. 201 with the updated card.
      query: ({ id, team_id, ...body }) => ({
        url: withTeam(`/cards/${id}/pay`, team_id),
        method: 'POST',
        body,
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Card', id }, LIST_TAG, 'Balance', TRANSACTION_LIST_TAG],
    }),
  }),
});

export const {
  useGetCardsQuery,
  useGetCardQuery,
  useAddCardMutation,
  useUpdateCardMutation,
  useDeleteCardMutation,
  usePayCardMutation,
} = cardsApi;
