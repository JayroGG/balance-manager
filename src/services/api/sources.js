import { baseApi } from './baseApi';

// /payment-sources + /source-aliases — user-scoped like /teams (no `?team_id=`; a source carries its
// own routing rule `target_team_id` instead). Aliases ride the same `Source` tag so any alias write
// refetches the sources screen in one go. (docs/backend-auto-capture-request.md, ADR-014)
export const sourcesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSources: build.query({
      query: () => '/payment-sources',
      providesTags: ['Source'],
    }),
    addSource: build.mutation({
      // arg: { name, type, bank?, target_team_id?, default_category_id? } — type ∈ account|credit_card;
      // target_team_id null/omitted = personal routing.
      query: (body) => ({ url: '/payment-sources', method: 'POST', body }),
      invalidatesTags: ['Source'],
    }),
    updateSource: build.mutation({
      // arg: { id, ...any create fields } — target_team_id: null re-routes to personal.
      query: ({ id, ...body }) => ({ url: `/payment-sources/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Source'],
    }),
    deleteSource: build.mutation({
      // Backend cascades the soft delete to the source's aliases.
      query: ({ id }) => ({ url: `/payment-sources/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Source'],
    }),
    getAliases: build.query({
      // arg: { source_id? } — omit to list all of the user's aliases.
      query: ({ source_id } = {}) => `/source-aliases${source_id ? `?source_id=${source_id}` : ''}`,
      providesTags: ['Source'],
    }),
    addAlias: build.mutation({
      // arg: { source_id, channel, match_kind, value? } — card_last4 needs a 4-digit value
      // (validated at the form boundary); channel_default sends no value.
      query: (body) => ({ url: '/source-aliases', method: 'POST', body }),
      invalidatesTags: ['Source'],
    }),
    deleteAlias: build.mutation({
      query: ({ id }) => ({ url: `/source-aliases/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Source'],
    }),
  }),
});

export const {
  useGetSourcesQuery,
  useAddSourceMutation,
  useUpdateSourceMutation,
  useDeleteSourceMutation,
  useGetAliasesQuery,
  useAddAliasMutation,
  useDeleteAliasMutation,
} = sourcesApi;
