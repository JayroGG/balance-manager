import { useSelector } from 'react-redux';
import { selectActiveTeamId } from '../reducers/context';

// Thin read of the active data context (null = personal). Mirrors useIdToken(). (ADR-011)
export const useActiveTeamId = () => useSelector(selectActiveTeamId);
