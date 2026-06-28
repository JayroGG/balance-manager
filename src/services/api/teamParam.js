// Append the active context's `?team_id=` to a request URL — and ONLY the URL (never a body field); the
// server injects team_id on writes. `null`/`undefined` = personal context → no param. Handles paths that
// already carry a query string (e.g. /transactions?type=expense). (ADR-011)
export const withTeam = (path, team_id) => {
  if (team_id == null) return path;
  return `${path}${path.includes('?') ? '&' : '?'}team_id=${team_id}`;
};
