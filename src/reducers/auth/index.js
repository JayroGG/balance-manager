import { createSlice } from '@reduxjs/toolkit';
import { Config } from '../../utils/config';

// Auth state = the single source the API token seam reads (ADR-001). In bypass mode we serve a
// placeholder token the backend ignores; with real auth (Auth0, Phase 2) `token` holds the idToken.
const PLACEHOLDER_TOKEN = 'bypass-placeholder-token';

const initialState = {
  token: null,
  user: null,
  bypass: Config.AUTH_BYPASS,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called once at cold start with the token read from secure-store (or null).
    hydrateAuth: (state, action) => {
      state.token = action.payload?.token ?? null;
      state.user = action.payload?.user ?? null;
      state.bootstrapped = true;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    clearAuth: (state) => {
      state.token = null;
      state.user = null;
    },
  },
});

export const { hydrateAuth, setToken, clearAuth } = authSlice.actions;

// Selectors — the only blessed way to read the token.
export const selectToken = (state) =>
  state.auth.token ?? (state.auth.bypass ? PLACEHOLDER_TOKEN : null);
export const selectIsAuthed = (state) => state.auth.bypass || !!state.auth.token;
export const selectBootstrapped = (state) => state.auth.bootstrapped;

export default authSlice.reducer;
