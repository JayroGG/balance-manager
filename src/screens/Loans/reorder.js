import { useDispatch, useSelector } from 'react-redux';
import { selectMyUserId } from '../../reducers/auth';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { mergeLoanOrder, saveLoanOrder } from '../../reducers/loanOrder';
import { orderKey } from '../../utils/savedOrder';

// Device-only order (no server sync). SortableList hands back (keys, items); keys are strings, loan ids may not be.
export function useOrderedLoans(loans) {
  const dispatch = useDispatch();
  const teamId = useActiveTeamId();
  const userId = useSelector(selectMyUserId);
  const entry = useSelector((s) => s.loanOrder?.byKey?.[orderKey(userId, teamId)]);
  const ordered = mergeLoanOrder(loans, entry);
  const onReorder = (_keys, items) => dispatch(saveLoanOrder({ userId, teamId, ids: items.map((l) => l.id) }));
  return { ordered, onReorder };
}
