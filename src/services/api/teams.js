import { baseApi } from './baseApi';

// /teams — team management + membership (ADR-012). Unlike the entity endpoints these are scoped by the
// team's :id in the PATH (not the `?team_id=` query param), so `withTeam` is NOT used here. `GET /teams`
// returns the caller's role per team ({ id, name, role }) and doubles as the source for `useActiveRole`.
// Member writes return the updated list, so member mutations invalidate the per-team `TeamMember` tag.
export const teamsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTeams: build.query({
      query: () => '/teams',
      providesTags: ['Team'],
    }),
    createTeam: build.mutation({
      // arg: { name, color? } — color is a '#RRGGBB' hex (validated at the form boundary).
      query: ({ name, color }) => ({
        url: '/teams',
        method: 'POST',
        body: color ? { name, color } : { name },
      }),
      invalidatesTags: ['Team'],
    }),
    updateTeam: build.mutation({
      // arg: { id, name?, color? } — send only what's given; color: null explicitly clears (ADR-013).
      query: ({ id, name, color }) => {
        const body = {};
        if (name !== undefined) body.name = name;
        if (color !== undefined) body.color = color;
        return { url: `/teams/${id}`, method: 'PUT', body };
      },
      invalidatesTags: ['Team'],
    }),
    deleteTeam: build.mutation({
      query: ({ id }) => ({ url: `/teams/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Team'],
    }),
    getMembers: build.query({
      // arg: team id
      query: (id) => `/teams/${id}/members`,
      providesTags: (r, e, id) => [{ type: 'TeamMember', id }],
    }),
    addMember: build.mutation({
      // arg: { id, email, role? } — role ∈ owner|member|guest (default member). 404 if the email has no account.
      query: ({ id, email, role }) => ({
        url: `/teams/${id}/members`,
        method: 'POST',
        body: role ? { email, role } : { email },
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'TeamMember', id }],
    }),
    updateMemberRole: build.mutation({
      // arg: { id, userId, role } — promote/demote. 400 if it would remove the last owner.
      query: ({ id, userId, role }) => ({
        url: `/teams/${id}/members/${userId}`,
        method: 'PUT',
        body: { role },
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'TeamMember', id }],
    }),
    removeMember: build.mutation({
      // arg: { id, userId }. 400 if it would remove the last owner.
      query: ({ id, userId }) => ({ url: `/teams/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'TeamMember', id }],
    }),
  }),
});

export const {
  useGetTeamsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useGetMembersQuery,
  useAddMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} = teamsApi;
