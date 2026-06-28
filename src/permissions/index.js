import { useSelector } from 'react-redux';
import { selectMyUserId } from '../reducers/auth';
import { useActiveRole } from '../hooks/useActiveRole';

// The single source of RBAC gating truth, mirroring the backend (ADR-012). The API enforces the same
// rules and 403s a disallowed write — this layer just hides affordances the user can't use.
//
//   role === null   → personal context: everything allowed (your own data)
//   'owner'         → add + edit/delete ANY row + manage the team
//   'member'        → add + edit/delete ONLY rows they created (row.user_id === myUserId)
//   'guest'         → read-only
//   undefined       → role not resolved yet → treat as read-only until it loads
//
// All checks are strict so `undefined` (loading) never reads as `null` (personal).

export const canAdd = (role) => role === null || role === 'owner' || role === 'member';

export const canManageTeam = (role) => role === 'owner';

export const canEditRow = (role, row, myUserId) => {
  if (role === null || role === 'owner') return true;
  if (role === 'member') return row != null && String(row.user_id) === String(myUserId);
  return false; // guest or unresolved
};

// Hook: bind the matrix to the active context + signed-in user.
export const usePermissions = () => {
  const role = useActiveRole();
  const myUserId = useSelector(selectMyUserId);
  return {
    role,
    canAdd: canAdd(role),
    canManageTeam: canManageTeam(role),
    canEditRow: (row) => canEditRow(role, row, myUserId),
  };
};
