import { baseApi } from './baseApi';
import { withTeam } from './teamParam';

// /events — read-only, append-only activity feed, newest first. Context-scoped like /transactions:
// optional team_id → URL `?team_id=` (never a body) and part of the cache key. No write routes and
// nothing invalidates 'Event': freshness = refetchOnMountOrArgChange + pull-to-refresh (ADR-017).
// Contract: balance/docs/react-native-activity-feed-update.md.
const LIST_TAG = { type: 'Event', id: 'LIST' };

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getEvents: build.query({
      // arg: { team_id?, entity?, action?, since_id?, limit? }
      query: ({ team_id, ...filters } = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.append(k, v);
        });
        const qs = params.toString();
        return withTeam(`/events${qs ? `?${qs}` : ''}`, team_id);
      },
      providesTags: [LIST_TAG],
    }),
  }),
});

export const { useGetEventsQuery } = eventsApi;
