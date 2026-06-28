import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

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

export const {
  useGetVaultsQuery,
  useGetVaultQuery,
  useGetVaultHistoryQuery,
  useAddVaultMutation,
  useUpdateVaultMutation,
  useDeleteVaultMutation,
  useAllocateVaultMutation,
  useWithdrawVaultMutation,
} = vaultsApi;
