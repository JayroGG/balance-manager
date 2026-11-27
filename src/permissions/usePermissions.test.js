const mockRole = { value: 'guest' };
const mockState = { value: {} };
jest.mock('../hooks/useActiveRole', () => ({ useActiveRole: () => mockRole.value }));
jest.mock('react-redux', () => ({ useSelector: (sel) => sel(mockState.value) }));

import { renderHook } from '@testing-library/react-native';
import { usePermissions } from './index';

// Global admin (JWT role claim) = owner affordances in every team, whatever the real membership role.
describe('usePermissions with a global admin', () => {
  const state = (isAdmin) => ({ auth: { user: { id: 1, isAdmin } } });

  it.each(['member', 'guest', 'owner'])('admin gets owner affordances as %s', (role) => {
    mockRole.value = role;
    mockState.value = state(true);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAdd).toBe(true);
    expect(result.current.canManageTeam).toBe(true);
    expect(result.current.canEditRow({ user_id: 99 })).toBe(true);
  });

  it('a non-admin guest stays read-only; an unresolved role stays read-only even for admin', () => {
    mockRole.value = 'guest';
    mockState.value = state(false);
    expect(renderHook(() => usePermissions()).result.current.canAdd).toBe(false);
    mockRole.value = undefined;
    mockState.value = state(true);
    expect(renderHook(() => usePermissions()).result.current.canAdd).toBe(false);
  });
});
