import { createSlice } from '@reduxjs/toolkit';

// Local-first vault order. One entry per (user, context): { userId, teamId, ids, pending }.
// `pending` = saved on device, not yet confirmed by PUT /vaults/order. While pending the local order
// wins; otherwise the backend order wins and `ids` is just a refreshed copy of it. Persisted; NOT reset
// on logout (keyed by user id, so a queued order survives and syncs on the next sign-in).
export const orderKey = (userId, teamId) => `${userId ?? 'anon'}:${teamId == null ? 'personal' : String(teamId)}`;

const slice = createSlice({
  name: 'vaultOrder',
  initialState: { byKey: {} },
  reducers: {
    // A drop: save immediately, mark pending.
    saveOrder: (state, { payload: { userId, teamId, ids } }) => {
      state.byKey[orderKey(userId, teamId)] = { userId, teamId: teamId ?? null, ids, pending: true };
    },
    // PUT succeeded: clear pending only if no newer drop happened meanwhile.
    orderSynced: (state, { payload: { userId, teamId, ids } }) => {
      const e = state.byKey[orderKey(userId, teamId)];
      if (e && e.pending && e.ids.join() === ids.join()) {
        e.pending = false;
        // Keep showing the local order until the server list agrees: a /balance refetch that was already
        // in flight before the PUT can land with the OLD order and would flip the UI back.
        e.awaiting = true; // released by `releaseHold` (sync.js timer) — a store action, never a clock read
      }
    },
    // Nothing pending/awaiting → refresh the local copy from the server list.
    refreshFromServer: (state, { payload: { userId, teamId, ids } }) => {
      const k = orderKey(userId, teamId);
      const e = state.byKey[k];
      if (e?.pending || e?.awaiting) return;
      if (!e || e.ids.join() !== ids.join()) {
        state.byKey[k] = { userId, teamId: teamId ?? null, ids, pending: false };
      }
    },
    // Ends the post-sync hold so the server order wins again (dispatched ~60s after a sync).
    releaseHold: (state, { payload: { userId, teamId } }) => {
      const e = state.byKey[orderKey(userId, teamId)];
      if (e && !e.pending) e.awaiting = false;
    },
  },
});

export const { saveOrder, orderSynced, refreshFromServer, releaseHold } = slice.actions;

// Pure: server vaults merged with a local entry. Pending → local ids first (in order), vaults missing
// locally go last in server order; ids no longer on the server are dropped. Not pending → server order.
// Pure: server vaults merged with a local entry. Pending or awaiting (synced, hold not yet released) →
// local ids first (in order), vaults missing locally go last in server order; ids no longer on the server
// are dropped. Otherwise server order. Every consumer derives from the entry alone — no clock.
export const mergeOrder = (vaults, entry) => {
  const list = vaults ?? [];
  if (!entry || !(entry.pending || entry.awaiting)) return list;
  const byId = new Map(list.map((v) => [v.id, v]));
  const head = entry.ids.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(head.map((v) => v.id));
  return [...head, ...list.filter((v) => !seen.has(v.id))];
};

export const selectOrderEntry = (state, userId, teamId) => state.vaultOrder?.byKey?.[orderKey(userId, teamId)];
export default slice.reducer;
