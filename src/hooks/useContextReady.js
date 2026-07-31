import { teamsApi } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';

const isFetchError = (error) =>
  error?.status === 'FETCH_ERROR' || error?.status === 'TIMEOUT_ERROR';

// The single authority on the ADR-019 invariant: a monetary figure is never rendered unless the
// context that owns it is confirmed.
//   confirmed   — personal (teamId == null) is confirmed by definition; a team context is confirmed
//                 only when that id resolves in the getTeams cache (persisted counts — team identity
//                 is slow-moving data, so offline confirmation from a persisted roster is legitimate).
//   stale       — the caller's money query has cached data but could not be revalidated this session.
//   offline     — inferred from RTK Query's FETCH_ERROR / TIMEOUT_ERROR (no netinfo dep — ADR-003).
//   lastUpdated — the caller's query's fulfilledTimeStamp (survives redux-persist on purpose — a cold
//                 start correctly reports the OLD fetch time, which is what the stale marker needs).
//
// Pass the caller's money-query result (e.g. useGetBalanceQuery(...)) so `stale`/`lastUpdated` describe
// that screen's own data; call with no argument for a confirmation-only check.
//
// ⚠️ Read-only cache access on purpose: useQueryState, NOT useGetTeamsQuery. This hook is called from
// screens and potentially rows, and the api sets refetchOnMountOrArgChange: true — a fetching
// subscription here would reproduce the request storm documented at useTheme.js:13-17. The long-lived
// screens (tabs layout, Dashboard, Teams) own the real GET /teams subscription and keep this cache fresh.
export const useContextReady = (query) => {
  const teamId = useActiveTeamId();
  const { data: teams, error: teamsError } = teamsApi.endpoints.getTeams.useQueryState();

  const confirmed = teamId == null || !!teams?.some((tm) => tm.id === teamId);
  const offline = isFetchError(query?.error) || isFetchError(teamsError);
  const stale = !!query?.data && (offline || (!query?.isFetching && !!query?.error));
  const lastUpdated = query?.fulfilledTimeStamp ?? null;

  return { confirmed, stale, offline, lastUpdated };
};
