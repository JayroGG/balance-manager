import Constants from 'expo-constants';

// Single read point for env config. Source: app.config.js `extra` (fed by .env.${APP_ENV}).
// Mirrors the old `Config.*` shape so call sites stay familiar (see .claude/ADR/ADR-003).
const extra = Constants.expoConfig?.extra ?? {};

// Bypass is honored ONLY in dev — even a misconfigured stage/prod env file can't skip real login (ADR-011).
export const Config = {
  API_URL: extra.apiUrl,
  AUTH_BYPASS: extra.authBypass === true && (extra.env ?? 'dev') === 'dev',
  ENV: extra.env ?? 'dev',
};
