import { baseApi } from './baseApi';

// /users/me — the caller's own account row (personal context color, ADR-028). No id in the path, no `?team_id=`.
// A 404/error (BE not deployed yet) is expected: callers fall back to DEFAULT_ACCENT, never crash.
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),
    updateMe: build.mutation({
      // arg: { color: '#RRGGBB' | null } — null restores the client default.
      query: ({ color }) => ({ url: '/users/me', method: 'PATCH', body: { color } }),
      // write the response straight into the cache so the accent switches at once
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(usersApi.util.upsertQueryData('getMe', undefined, data));
        } catch {
          /* surfaced by the caller */
        }
      },
    }),
  }),
});

export const { useGetMeQuery, useUpdateMeMutation } = usersApi;
