import Constants from 'expo-constants';

// Single read point for env config. Source: app.config.js `extra` (fed by .env.${APP_ENV}).
// Mirrors the old `Config.*` shape so call sites stay familiar (see .claude/ADR/ADR-003).
const extra = Constants.expoConfig?.extra ?? {};

export const Config = {
  API_URL: extra.apiUrl,
  AUTH_BYPASS: extra.authBypass === true,
  ENV: extra.env ?? 'dev',
};
