import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { selectIsAuthed } from '../reducers/auth';
import { selectThemeMode } from '../reducers/prefs';
import { useGetTeamsQuery } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';
import { DEFAULT_ACCENT, makeColors } from '../components/theme';
import { normalizeHex } from '../utils/colors';

// THE theme seam (ADR-013). Everything is derived, never stored (same rule as useActiveRole):
//   scheme — persisted prefs.themeMode ('system' follows the OS via useColorScheme)
//   accent — the active team's `color` from the cached GET /teams; personal (null) or no color → default
// getTeams is skipped pre-auth so the Login screen themes without firing an unauthenticated call.
export const useTheme = () => {
  const system = useColorScheme();
  const themeMode = useSelector(selectThemeMode);
  const authed = useSelector(selectIsAuthed);
  const teamId = useActiveTeamId();
  const { data: teams } = useGetTeamsQuery(undefined, { skip: !authed });

  const scheme = themeMode === 'system' ? (system ?? 'light') : themeMode;
  const team = teamId == null ? null : teams?.find((tm) => tm.id === teamId);
  const accent = (team?.color && normalizeHex(team.color)) || DEFAULT_ACCENT;

  return { colors: makeColors(scheme, accent), scheme, accent };
};
