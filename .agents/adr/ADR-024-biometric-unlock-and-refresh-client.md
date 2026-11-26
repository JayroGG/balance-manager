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

## Consequences
- Password sits in the device keychain; anyone who passes the device biometric can open the app.
  Accepted by the owner.
- New native deps (local-authentication, gesture-handler, reanimated) → new native build.

## Implementation notes
- Refresh: `src/services/api/baseApi.js` (module-level shared promise), `session.js` (`saveSession`), refresh token in SecureStore (`secure.js`).
- Credentials + enabled flag: `src/services/storage/biometric.js`. Lock state: `src/reducers/lock` (not persisted), decided in `app/_layout.jsx` Bootstrap before the first render; `useAppLockWatcher` re-locks after > 5 min in background.
- Vault order is local-first: a drop is saved on the device at once (persisted per user + context) and synced to `PUT /vaults/order` in the background (debounced, retried on foreground, silent on failure); with nothing pending the BE order wins. Dashboard shows the first 3 vaults with `balance > 0` + "See all vaults".
- Settings toggle can only turn the lock OFF; ON happens automatically at the next password login on a biometric-enrolled device.
