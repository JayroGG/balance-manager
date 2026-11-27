import { useTranslation } from 'react-i18next';
import { useGetTeamsQuery } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';

// Contexts where the caller is a REAL owner: personal always, teams only with role === 'owner'
// (a global 'admin' is not an owner — transfers have no admin bypass, ADR-017).
export const useOwnedContexts = () => {
  const { t } = useTranslation();
  const activeId = useActiveTeamId();
  const { data: teams } = useGetTeamsQuery();
  const owned = (teams ?? []).filter((team) => team.role === 'owner');
  return [
    { team_id: null, label: t('context.personal'), isCurrent: activeId == null },
    ...owned.map((team) => ({ team_id: team.id, label: team.name, isCurrent: activeId === team.id })),
  ];
};
