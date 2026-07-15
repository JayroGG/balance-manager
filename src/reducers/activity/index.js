import { createSlice } from '@reduxjs/toolkit';

// Last-seen event id per context — drives the unread badge (ADR-017). Keyed 'personal' | String(teamId)
// because object keys stringify anyway. Persisted (non-secret), reset on logout like context (ADR-011).
export const contextKey = (teamId) => (teamId == null ? 'personal' : String(teamId));

const initialState = { lastSeen: {} };

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    markSeen: (state, action) => {
      const { key, id } = action.payload;
      const current = state.lastSeen[key];
      if (current == null || id > current) state.lastSeen[key] = id; // only ever advances
    },
    resetActivity: () => initialState,
  },
});

export const { markSeen, resetActivity } = activitySlice.actions;
export const selectLastSeen = (state, teamId) => state.activity.lastSeen[contextKey(teamId)] ?? null;
export default activitySlice.reducer;
