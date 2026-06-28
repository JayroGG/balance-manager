import { useGetTeamsQuery } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';

// The caller's role in the active context, derived from the cached GET /teams (single source of truth)
// + activeTeamId — never stored separately, so it can't go stale (ADR-012).
//   null      → personal context (full access to your own data)
//   'owner' | 'member' | 'guest' → the role for the active team
//   undefined → team selected but the teams list hasn't resolved yet → callers treat as read-only
export const useActiveRole = () => {
  const teamId = useActiveTeamId();
  const { data: teams } = useGetTeamsQuery();
  if (teamId == null) return null;
  return teams?.find((team) => team.id === teamId)?.role;
};
