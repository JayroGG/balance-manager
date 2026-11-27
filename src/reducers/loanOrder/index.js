import { createSlice } from '@reduxjs/toolkit';

// Device-only loan order (ADR-026): one entry per (user, context) { ids }. No server sync. Persisted;
// NOT reset on logout (keyed by user id).
export const loanOrderKey = (userId, teamId) => `${userId ?? 'anon'}:${teamId == null ? 'personal' : String(teamId)}`;

const slice = createSlice({
  name: 'loanOrder',
  initialState: { byKey: {} },
  reducers: {
    saveLoanOrder: (state, { payload: { userId, teamId, ids } }) => {
      state.byKey[loanOrderKey(userId, teamId)] = { ids };
    },
  },
});

export const { saveLoanOrder } = slice.actions;

// Pure: known ids first (in saved order), loans not in the saved order after them in server order;
// saved ids that no longer exist are dropped.
export const mergeLoanOrder = (loans, entry) => {
  const list = loans ?? [];
  if (!entry?.ids?.length) return list;
  const byId = new Map(list.map((l) => [l.id, l]));
  const head = entry.ids.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(head.map((l) => l.id));
  return [...head, ...list.filter((l) => !seen.has(l.id))];
};

export default slice.reducer;
