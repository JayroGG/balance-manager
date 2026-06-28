import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /categories — CRUD. kind ∈ income | expense | both. No money fields. Every arg carries an optional
// team_id → URL `?team_id=` (never the body) and part of the cache key. (PRD §4.1, ADR-011)
export const categoriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategories: build.query({
      // arg: team_id (null/undefined = personal)
      query: (team_id) => withTeam('/categories', team_id),
      providesTags: (result) =>
        result
          ? [...result.map((c) => ({ type: 'Category', id: c.id })), { type: 'Category', id: 'LIST' }]
          : [{ type: 'Category', id: 'LIST' }],
    }),
    addCategory: build.mutation({
      query: ({ team_id, ...body }) => ({ url: withTeam('/categories', team_id), method: 'POST', body }),
      invalidatesTags: [{ type: 'Category', id: 'LIST' }],
    }),
    updateCategory: build.mutation({
      query: ({ id, team_id, ...body }) => ({ url: withTeam(`/categories/${id}`, team_id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Category', id }, { type: 'Category', id: 'LIST' }],
    }),
    deleteCategory: build.mutation({
      query: ({ id, team_id }) => ({ url: withTeam(`/categories/${id}`, team_id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'Category', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = categoriesApi;
