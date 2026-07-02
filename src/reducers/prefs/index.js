import { createSlice } from '@reduxjs/toolkit';

// Device-level preferences — NOT session data: persisted (redux-persist whitelist) and deliberately
// not reset on logout. `themeMode` drives useTheme: 'system' follows the OS scheme; 'light'/'dark'
// force one. (ADR-013)
export const THEME_MODES = ['system', 'light', 'dark'];

const initialState = {
  themeMode: 'system',
};

const prefsSlice = createSlice({
  name: 'prefs',
  initialState,
  reducers: {
    setThemeMode: (state, action) => {
      if (THEME_MODES.includes(action.payload)) state.themeMode = action.payload;
    },
  },
});

export const { setThemeMode } = prefsSlice.actions;

export const selectThemeMode = (state) => state.prefs.themeMode;

export default prefsSlice.reducer;
