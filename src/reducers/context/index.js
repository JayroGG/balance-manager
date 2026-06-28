import { createSlice } from '@reduxjs/toolkit';

// The active data context: null = personal, a team id = that team. Threaded into every entity call as
// `?team_id=` (never a body field) so RTK Query caches personal/team separately. Persisted (non-secret),
// reset on logout. (ADR-011)
const initialState = {
  activeTeamId: null,
};

const contextSlice = createSlice({
  name: 'context',
  initialState,
  reducers: {
    setActiveTeam: (state, action) => {
      state.activeTeamId = action.payload ?? null;
    },
    resetContext: (state) => {
      state.activeTeamId = null;
    },
  },
});

export const { setActiveTeam, resetContext } = contextSlice.actions;

export const selectActiveTeamId = (state) => state.context.activeTeamId;

export default contextSlice.reducer;
