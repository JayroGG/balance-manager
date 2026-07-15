import { useSelector } from 'react-redux';
import { useGetEventsQuery } from '../services/api/events';
import { selectLastSeen } from '../reducers/activity';
import { useActiveTeamId } from './useActiveTeamId';

// Unread events in the active context = events newer than the persisted last-seen id (ADR-017).
// No lastSeen yet (context never opened the feed) → skip the fetch, show no badge; the first feed
// open seeds it. lastSeen 0 (seeded on an empty feed) → omit since_id (must be positive) = all events.
export const useUnreadActivity = () => {
  const teamId = useActiveTeamId();
  const lastSeen = useSelector((s) => selectLastSeen(s, teamId));
  const { data } = useGetEventsQuery(
    { team_id: teamId, since_id: lastSeen > 0 ? lastSeen : undefined, limit: 200 },
    { skip: lastSeen == null },
  );
  return lastSeen == null ? 0 : (data?.length ?? 0);
};
