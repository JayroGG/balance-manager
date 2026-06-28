import { baseApi } from './baseApi';

// GET /teams — read-only, populates the Dashboard's Personal/Team switch. Team-management CRUD
// (create/rename/delete, add/remove members) is deferred (ADR-011) — no mutations here.
export const teamsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTeams: build.query({
      query: () => '/teams',
      providesTags: ['Team'],
    }),
  }),
});

export const { useGetTeamsQuery } = teamsApi;
