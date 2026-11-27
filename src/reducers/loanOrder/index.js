import { createSlice } from '@reduxjs/toolkit';
import { orderKey, applySavedOrder } from '../../utils/savedOrder';

// Device-only loan order (ADR-026): one entry per (user, context) { ids }. No server sync. Persisted;
// NOT reset on logout (keyed by user id).
const slice = createSlice({
  name: 'loanOrder',
  initialState: { byKey: {} },
  reducers: {
    saveLoanOrder: (state, { payload: { userId, teamId, ids } }) => {
      state.byKey[orderKey(userId, teamId)] = { ids };
    },
  },
});

export const { saveLoanOrder } = slice.actions;

// Pure: known ids first (in saved order), loans not in the saved order after them in server order;
// saved ids that no longer exist are dropped.
export const mergeLoanOrder = (loans, entry) => {
  const list = loans ?? [];
  if (!entry?.ids?.length) return list;
  return applySavedOrder(list, entry.ids);
};

export default slice.reducer;
