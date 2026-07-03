import { baseApi } from './baseApi';

// /captures — the client side of the ingest ledger. The app never POSTs captures itself (devices do,
// with an ingest-scoped token); it reads the review inbox (?status=pending) and resolves it: confirm
// links a source and posts a real transaction (hence Transaction/Balance invalidation), discard parks
// the evidence. (docs/backend-auto-capture-request.md, ADR-014)
export const capturesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCaptures: build.query({
      // arg: { status? } — the inbox reads { status: 'pending' }.
      query: ({ status } = {}) => `/captures${status ? `?status=${status}` : ''}`,
      providesTags: ['Capture'],
    }),
    confirmCapture: build.mutation({
      // arg: { id, source_id, team_id?, category_id? } — overrides beat the source's defaults.
      // team_id travels in the body HERE ONLY: it's the confirm contract's override field, not the
      // entity-CRUD context param.
      query: ({ id, ...body }) => ({ url: `/captures/${id}/confirm`, method: 'POST', body }),
      invalidatesTags: ['Capture', 'Transaction', 'Balance'],
    }),
    discardCapture: build.mutation({
      query: ({ id }) => ({ url: `/captures/${id}/discard`, method: 'POST' }),
      invalidatesTags: ['Capture'],
    }),
  }),
});

export const {
  useGetCapturesQuery,
  useConfirmCaptureMutation,
  useDiscardCaptureMutation,
} = capturesApi;
