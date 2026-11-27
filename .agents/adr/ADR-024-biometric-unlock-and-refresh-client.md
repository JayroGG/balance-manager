# ADR-024 — Biometric unlock and refresh-token client

- **Status:** Accepted (FE `balance-manager`; BE ADR-015 / ADR-016)
- **Date:** 2026-11-26

## Context
The user wants to stop typing the password: token refresh (BE ADR-015) and a fingerprint to open the app.
Biometrics here are a device convenience lock, not a server-side control.

## Decision
- Access + refresh tokens in SecureStore (ADR-006). `baseApi` handles 401 with one shared in-flight
  refresh and one retry; refresh failure → `hardLogout` (ADR-019).
- After a password login on a device with enrolled biometrics, `{email,password}` are saved in
  SecureStore. `hardLogout` keeps them; the Settings toggle deletes them.
- Lock screen on cold start and on resume after > 5 min background when creds are stored.
  `expo-local-authentication` OK → unlock, or log in with the stored creds if logged out. Fallback is
  the password form. Rejected stored creds are deleted.

### Amendment (2026-11-27): the lock is mandatory
Owner: the app must be forcibly blocked until Face ID / Touch ID or the password is submitted. Whenever a session exists
the app is locked at cold start and on resume after the grace window (5 min), whether or not biometrics are enabled.
`lock.enabled` now only picks the unlock method: enabled -> OS prompt (auto) with "Use password" in place; otherwise the
password form (email pre-filled and read-only from the session). The password is verified by the backend with
`POST /auth/step-up` (`track:false`, no new session, no client-side check); a wrong password is an inline error and a
network failure a retry, both stay locked: no bypass. "Log out" is always on the lock screen. `LockGate` (root) renders
the Lock screen instead of the app while locked, and an opaque `PrivacyCover` while the app is inactive/in background so
the app-switcher snapshot shows no balances. `initLock({enabled, locked})`; `lockApp` is unconditional (the watcher
guards on session or biometric creds).
A dead session (refresh token missing/rejected: `error.refresh === 'invalid'`, set by baseApi) is not reported as a wrong
password: the lock ends it (`hardLogout`) and shows Login; a transient refresh failure (`'transient'`) shows the network
retry. The BE answers 401 for both a wrong password and an expired bearer, so every wrong password also runs the shared
refresh once (a token rotation) before the final 401: accepted. `disableDeviceFallback:false` is intended: the device
passcode also unlocks. The cover (`PrivacyCover`) is JS-rendered and shown on 'inactive'/'background' (ignored while the
app's own Face ID sheet is open, `isBiometricPrompting`); in dev AUTH_BYPASS the watcher never locks.
**Known limitation (owner decision 2026-11-27, accepted):** the Android recents-screen thumbnail is NOT guaranteed to be
covered, because the JS cover may not paint before Android captures it. The robust fix (FLAG_SECURE via
`expo-screen-capture`) was declined: no new dependency. iOS app-switcher snapshots are covered. Rate limiting is a
follow-up.

## Consequences
- Password sits in the device keychain; anyone who passes the device biometric can open the app.
  Accepted by the owner.
- New native deps (local-authentication, gesture-handler, reanimated) → new native build.

## Implementation notes
- Refresh: `src/services/api/baseApi.js` (module-level shared promise), `session.js` (`saveSession`), refresh token in SecureStore (`secure.js`).
- Credentials + enabled flag: `src/services/storage/biometric.js`. Lock state: `src/reducers/lock` (not persisted), decided in `app/_layout.jsx` Bootstrap before the first render; `useAppLockWatcher` re-locks after > 5 min in background.
- Vault order is local-first: a drop is saved on the device at once (persisted per user + context) and synced to `PUT /vaults/order` in the background (debounced, retried on foreground, silent on failure); with nothing pending the BE order wins. Dashboard shows the first 3 vaults with `balance > 0` + "See all vaults".
- Settings toggle can only turn the lock OFF; ON happens automatically at the next password login on a biometric-enrolled device.
