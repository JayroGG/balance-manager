import { createSlice } from '@reduxjs/toolkit';

// App-lock state. NOT persisted (the lock decision is made fresh in Bootstrap on every cold start).
// The lock is MANDATORY whenever a session exists (not only with biometrics): `locked` is decided at cold start
// (initLock) and on resume (lockApp). enabled = fingerprint creds are stored (biometric unlock available);
// locked = the lock screen covers the app;
// passwordOnly = user chose "Use password", so Login must not auto-open the prompt again;
// rejected = stored creds were refused by /auth/login (Login shows a message).
const lockSlice = createSlice({
  name: 'lock',
  initialState: { enabled: false, locked: false, passwordOnly: false, rejected: false },
  reducers: {
    // { enabled, locked }: enabled = biometric creds stored; locked = a session (or biometric creds) exists
    initLock: (state, action) => {
      state.enabled = !!action.payload.enabled;
      state.locked = !!action.payload.locked;
    },
    setLockEnabled: (state, action) => {
      state.enabled = !!action.payload;
      if (!action.payload) state.locked = false;
    },
    lockApp: (state) => {
      state.locked = true;
    },
    unlockApp: (state) => {
      state.locked = false;
      state.passwordOnly = false;
    },
    usePasswordInstead: (state) => {
      state.locked = false;
      state.passwordOnly = true;
    },
    clearPasswordOnly: (state) => {
      state.passwordOnly = false;
    },
    credsRejected: (state) => {
      state.enabled = false;
      state.locked = false;
      state.rejected = true;
    },
    clearRejected: (state) => {
      state.rejected = false;
    },
  },
});

export const {
  initLock,
  setLockEnabled,
  lockApp,
  unlockApp,
  usePasswordInstead,
  clearPasswordOnly,
  credsRejected,
  clearRejected,
} = lockSlice.actions;

export default lockSlice.reducer;
