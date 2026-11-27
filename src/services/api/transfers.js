import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /transfers — append-only inter-context transfers (ADR-017/027). Create/reverse need a fresh step-up
// permit, sent as the X-Step-Up header for that single request (never stored). Tags aren't team-keyed,
// so plain tags refresh BOTH contexts' balance / transactions / vaults / activity.
const INVALIDATES = [
  'Balance',
  { type: 'Transaction', id: 'LIST' },
  'Vault',
  'VaultHistory',
  { type: 'Event', id: 'LIST' },
  'Transfer',
];

const stepUpHeaders = (permit) => (permit ? { 'X-Step-Up': permit } : undefined);

export const isStepUpRequired = (error) =>
  error?.status === 403 && error?.data?.code === 'STEP_UP_REQUIRED';

export const transfersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransfers: build.query({
      // arg: { team_id? }
      query: ({ team_id } = {}) => withTeam('/transfers', team_id),
      providesTags: ['Transfer'],
    }),
    createTransfer: build.mutation({
      // arg: { team_id, permit, body: { to_team_id|null, amount, description?, occurred_at?, vaults? } }
      query: ({ team_id, permit, body }) => ({
        url: withTeam('/transfers', team_id),
        method: 'POST',
        body,
        headers: stepUpHeaders(permit),
      }),
      invalidatesTags: INVALIDATES,
    }),
    reverseTransfer: build.mutation({
      // arg: { id, team_id, permit }
      query: ({ id, team_id, permit }) => ({
        url: withTeam(`/transfers/${id}/reverse`, team_id),
        method: 'POST',
        headers: stepUpHeaders(permit),
      }),
      invalidatesTags: INVALIDATES,
    }),
  }),
});

export const { useGetTransfersQuery, useCreateTransferMutation, useReverseTransferMutation } = transfersApi;
