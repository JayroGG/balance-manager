import { baseApi } from './baseApi';

// /vaults — CRUD + history + allocate/withdraw. Per-vault balances/targets come from GET /balance,
// so allocate/withdraw (and vault edits) invalidate Balance too. Only income txns can be allocated;
// allocating a txn already in another vault moves it. (PRD §4.1, ADR-005)
const LIST_TAG = { type: 'Vault', id: 'LIST' };

export const vaultsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVaults: build.query({
      query: () => '/vaults',
      providesTags: (result) =>
        result ? [...result.map((v) => ({ type: 'Vault', id: v.id })), LIST_TAG] : [LIST_TAG],
    }),
    getVault: build.query({
      query: (id) => `/vaults/${id}`,
      providesTags: (r, e, id) => [{ type: 'Vault', id }],
    }),
    getVaultHistory: build.query({
      query: (id) => `/vaults/${id}/history`,
      providesTags: (r, e, id) => [{ type: 'VaultHistory', id }],
    }),
    addVault: build.mutation({
      query: (body) => ({ url: '/vaults', method: 'POST', body }),
      invalidatesTags: [LIST_TAG, 'Balance'],
    }),
    updateVault: build.mutation({
      query: ({ id, ...body }) => ({ url: `/vaults/${id}`, method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Vault', id }, LIST_TAG, 'Balance'],
    }),
    deleteVault: build.mutation({
      query: (id) => ({ url: `/vaults/${id}`, method: 'DELETE' }),
      invalidatesTags: (r, e, id) => [{ type: 'Vault', id }, LIST_TAG, 'Balance'],
    }),
    allocateVault: build.mutation({
      // arg: { id, transaction_id }
      query: ({ id, transaction_id }) => ({
        url: `/vaults/${id}/allocate`,
        method: 'POST',
        body: { transaction_id },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Vault', id },
        { type: 'VaultHistory', id },
        LIST_TAG,
        'Balance',
        { type: 'Transaction', id: 'LIST' },
      ],
    }),
    withdrawVault: build.mutation({
      // arg: { id, transaction_id }
      query: ({ id, transaction_id }) => ({
        url: `/vaults/${id}/withdraw`,
        method: 'POST',
        body: { transaction_id },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Vault', id },
        { type: 'VaultHistory', id },
        LIST_TAG,
        'Balance',
        { type: 'Transaction', id: 'LIST' },
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
