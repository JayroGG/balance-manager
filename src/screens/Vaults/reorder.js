import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectMyUserId } from '../../reducers/auth';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { mergeOrder, orderKey, refreshFromServer, saveOrder } from '../../reducers/vaultOrder';

// Local-first order: a drop saves to the device at once (persisted, pending); the background sync
// (reducers/vaultOrder/sync.js) PUTs it later. Used by the Vaults list and the Dashboard top-3.
export function useOrderedVaults(vaults) {
  const dispatch = useDispatch();
  const teamId = useActiveTeamId();
  const userId = useSelector(selectMyUserId);
  const entry = useSelector((s) => s.vaultOrder?.byKey?.[orderKey(userId, teamId)]);
  const ordered = mergeOrder(vaults, entry);

  const serverIds = (vaults ?? []).map((v) => v.id).join();
  useEffect(() => {
    if (!vaults) return;
    dispatch(refreshFromServer({ userId, teamId, ids: vaults.map((v) => v.id)}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverIds, userId, teamId, entry?.pending, entry?.awaiting]);

  // SortableList hands back (keys, items); keys are strings, vault ids are numbers — save the real ids.
  const onReorder = (_keys, items) => dispatch(saveOrder({ userId, teamId, ids: items.map((v) => v.id) }));

  return { ordered, onReorder };
}
