import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /shopping-lists (+ items + checkout) — pre-expense checklists that become one transaction at
// checkout (ADR-015). Context-scoped like transactions/vaults: every arg carries an optional team_id
// → URL `?team_id=` (never the body) and part of the cache key. Lists + their items share the
// `ShoppingList` tag so any item write refetches the list screens. Checkout posts an expense
// server-side, so it invalidates Transaction + Balance too (mirrors vault allocate/withdraw, ADR-009).
// Contract: docs/backend-shopping-lists-request.md.
const LIST_TAG = { type: 'ShoppingList', id: 'LIST' };
const itemsTag = (listId) => ({ type: 'ShoppingList', id: `ITEMS-${listId}` });

export const shoppingListsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getShoppingLists: build.query({
      // arg: { status?, team_id? }
      query: ({ team_id, ...filters } = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.append(k, v);
        });
        const qs = params.toString();
        return withTeam(`/shopping-lists${qs ? `?${qs}` : ''}`, team_id);
      },
      providesTags: (result) =>
        result
          ? [...result.map((l) => ({ type: 'ShoppingList', id: l.id })), LIST_TAG]
          : [LIST_TAG],
    }),
    getShoppingList: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/shopping-lists/${id}`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'ShoppingList', id }],
    }),
    addShoppingList: build.mutation({
      // arg: { name, category_id?, team_id? }
      query: ({ team_id, ...body }) => ({ url: withTeam('/shopping-lists', team_id), method: 'POST', body }),
      invalidatesTags: [LIST_TAG],
    }),
    updateShoppingList: build.mutation({
      // arg: { id, team_id?, ...fields } — open lists only (backend 400s a frozen edit).
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/shopping-lists/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'ShoppingList', id }, LIST_TAG],
    }),
    deleteShoppingList: build.mutation({
      // Soft-delete; never touches a purchased list's transaction. Backend cascades to items.
      query: ({ id, team_id }) => ({ url: withTeam(`/shopping-lists/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'ShoppingList', id }, LIST_TAG],
    }),

    getItems: build.query({
      // arg: { list_id, team_id? }
      query: ({ list_id, team_id }) => withTeam(`/shopping-list-items?list_id=${list_id}`, team_id),
      providesTags: (r, e, { list_id }) => [itemsTag(list_id)],
    }),
    addItem: build.mutation({
      // arg: { list_id, name, qty?, price?, team_id? } — price is a decimal per-unit estimate.
      query: ({ team_id, ...body }) => ({ url: withTeam('/shopping-list-items', team_id), method: 'POST', body }),
      invalidatesTags: (r, e, { list_id }) => [itemsTag(list_id), { type: 'ShoppingList', id: list_id }],
    }),
    updateItem: build.mutation({
      // arg: { id, list_id, team_id?, ...fields } — the common case is a { checked } toggle.
      query: ({ id, list_id, team_id, ...body }) => ({
        url: withTeam(`/shopping-list-items/${id}`, team_id),
        method: 'PUT',
        body,
      }),
      invalidatesTags: (r, e, { list_id }) => [itemsTag(list_id), { type: 'ShoppingList', id: list_id }],
      // Optimistic patch so the checkbox flips instantly in-store; roll back if the write fails.
      async onQueryStarted({ id, list_id, team_id, ...patch }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          shoppingListsApi.util.updateQueryData('getItems', { list_id, team_id }, (draft) => {
            const row = draft?.find((it) => it.id === id);
            if (row) Object.assign(row, patch);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
    }),
    deleteItem: build.mutation({
      query: ({ id, team_id }) => ({ url: withTeam(`/shopping-list-items/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { list_id }) => [itemsTag(list_id), { type: 'ShoppingList', id: list_id }],
    }),

    checkoutList: build.mutation({
      // arg: { id, team_id?, amount, category_id?, occurred_at? } — posts an `expense` titled with the
      // list name in the list's context, links it, and flips status → 'purchased' (all server-side).
      // No team fields in the body: the list's context comes from the ?team_id= param (ADR-015).
      query: ({ id, team_id, ...body }) => ({
        url: withTeam(`/shopping-lists/${id}/checkout`, team_id),
        method: 'POST',
        body,
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'ShoppingList', id },
        LIST_TAG,
        'Transaction',
        'Balance',
      ],
    }),
  }),
});

export const {
  useGetShoppingListsQuery,
  useGetShoppingListQuery,
  useAddShoppingListMutation,
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  useGetItemsQuery,
  useAddItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useCheckoutListMutation,
} = shoppingListsApi;
