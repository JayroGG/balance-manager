jest.mock('../services/api/teams', () => ({ useGetTeamsQuery: jest.fn() }));
jest.mock('./useActiveTeamId', () => ({ useActiveTeamId: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

import { renderHook } from '@testing-library/react-native';
import { useGetTeamsQuery } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';
import { useOwnedContexts } from './useOwnedContexts';

describe('useOwnedContexts', () => {
  it('returns personal + only real-owner teams, flagging the current one', () => {
    useGetTeamsQuery.mockReturnValue({
      data: [
        { id: 1, name: 'Casa', role: 'owner' },
        { id: 2, name: 'Work', role: 'admin' },
        { id: 3, name: 'Club', role: 'member' },
      ],
    });
    useActiveTeamId.mockReturnValue(1);
    const { result } = renderHook(() => useOwnedContexts());
    expect(result.current).toEqual([
      { team_id: null, label: 'context.personal', isCurrent: false },
      { team_id: 1, label: 'Casa', isCurrent: true },
    ]);
  });

  it('is personal-only while teams are loading', () => {
    useGetTeamsQuery.mockReturnValue({ data: undefined });
    useActiveTeamId.mockReturnValue(null);
    const { result } = renderHook(() => useOwnedContexts());
    expect(result.current).toEqual([{ team_id: null, label: 'context.personal', isCurrent: true }]);
  });
});
