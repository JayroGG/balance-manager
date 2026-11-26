import { baseApi } from './baseApi';
import { withTeam } from './teamParam';
import { balanceApi } from './balance';

// /vaults — CRUD + history + allocate/withdraw. Per-vault balances/targets come from GET /balance,
// so allocate/withdraw (and vault edits) invalidate Balance too. Allocate/withdraw move an `amount`
// between spendable and the vault (not a tagged transaction). Every arg carries an optional team_id →
// URL `?team_id=` (never the body) and part of the cache key. (PRD §4.1, ADR-009 / ADR-011)
const LIST_TAG = { type: 'Vault', id: 'LIST' };

export const vaultsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVaults: build.query({
      // arg: team_id (null/undefined = personal)
      query: (team_id) => withTeam('/vaults', team_id),
      providesTags: (result) =>
        result ? [...result.map((v) => ({ type: 'Vault', id: v.id })), LIST_TAG] : [LIST_TAG],
    }),
    getVault: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/vaults/${id}`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'Vault', id }],
    }),
    getVaultHistory: build.query({
      // arg: { id, team_id? }
      query: ({ id, team_id }) => withTeam(`/vaults/${id}/history`, team_id),
      providesTags: (r, e, { id }) => [{ type: 'VaultHistory', id }],
    }),
    addVault: build.mutation({
      query: ({ team_id, ...body }) => ({ url: withTeam('/vaults', team_id), method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance'],
    }),
    updateVault: build.mutation({
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/vaults/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Vault', id }, LIST_TAG, 'Balance'],
    }),
    deleteVault: build.mutation({
      query: ({ id, team_id }) => ({ url: withTeam(`/vaults/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Vault', id }, LIST_TAG, 'Balance'],
    }),
    reorderVaults: build.mutation({
      // arg: { ids, team_id? } — stores the caller's own vault order (204). Order shows in GET /vaults + /balance.
      query: ({ ids, team_id }) => ({ url: withTeam('/vaults/order', team_id), method: 'PUT', body: { ids } }),
      // No tag invalidation: a refetch mid-sync would flash the stale server order. The caller patches the
      // caches with `applyOrderToCache` once the PUT succeeds.
    }),
    allocateVault: build.mutation({
      // arg: { id, amount, team_id? } — moves spendable → vault (decimal). Bounded by `available` (400 if over).
      query: ({ id, amount, team_id }) => ({
        url: withTeam(`/vaults/${id}/allocate`, team_id),
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Vault', id },
        { type: 'VaultHistory', id },
        LIST_TAG,
        'Balance',
      ],
    }),
    withdrawVault: build.mutation({
      // arg: { id, amount, team_id? } — moves vault → spendable (decimal). Bounded by the vault balance (400 if over).
      query: ({ id, amount, team_id }) => ({
        url: withTeam(`/vaults/${id}/withdraw`, team_id),
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Vault', id },
        { type: 'VaultHistory', id },
        LIST_TAG,
        'Balance',
      ],
    }),
  }),
});

// Items with an id in `ids` first (in that order), the rest after in their current order.
const sortByIds = (items, ids) => {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return items
    .map((v, i) => [v, i])
    .sort(([a, ia], [b, ib]) => (rank.get(a.id) ?? ids.length + ia) - (rank.get(b.id) ?? ids.length + ib))
    .map(([v]) => v);
};

// Re-sorts the cached vault lists (GET /vaults + /balance `vaults`) to a just-synced order.
export const applyOrderToCache = (dispatch, { ids, team_id }) => {
  dispatch(vaultsApi.util.updateQueryData('getVaults', team_id, (draft) => sortByIds(draft, ids)));
  dispatch(
    balanceApi.util.updateQueryData('getBalance', team_id, (draft) => {
      draft.vaults = sortByIds(draft.vaults, ids);
    }),
  );
};

export const {
  useGetVaultsQuery,
  useGetVaultQuery,
  useGetVaultHistoryQuery,
  useAddVaultMutation,
  useUpdateVaultMutation,
  useDeleteVaultMutation,
  useReorderVaultsMutation,
  useAllocateVaultMutation,
  useWithdrawVaultMutation,
} = vaultsApi;
