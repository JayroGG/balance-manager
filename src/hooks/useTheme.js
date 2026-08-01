import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { selectThemeMode } from '../reducers/prefs';
import { teamsApi } from '../services/api/teams';
import { useActiveTeamId } from './useActiveTeamId';
import { DEFAULT_ACCENT, makeColors } from '../components/theme';
import { normalizeHex } from '../utils/colors';

// THE theme seam (ADR-013). Everything is derived, never stored (same rule as useActiveRole):
//   scheme — persisted prefs.themeMode ('system' follows the OS via useColorScheme)
//   accent — the active team's `color` from the cached GET /teams; personal (null) or no color → default
//
// ⚠️ Read-only cache access on purpose: useQueryState, NOT useGetTeamsQuery. This hook runs in every
// themed atom (Card, Chip, …), and a fetching subscription here + the api-level
// refetchOnMountOrArgChange:true means every row/atom (re)mount fires another GET /teams — an infinite
// request storm on list screens. The long-lived screens (tabs layout, Dashboard, Teams) own the real
// subscription and keep this cache fresh.
export const useTheme = () => {
  const system = useColorScheme();
  const themeMode = useSelector(selectThemeMode);
  const teamId = useActiveTeamId();
  const { data: teams } = teamsApi.endpoints.getTeams.useQueryState();

  const scheme = themeMode === 'system' ? (system ?? 'light') : themeMode;
  const team = teamId == null ? null : teams?.find((tm) => tm.id === teamId);
  const accent = (team?.color && normalizeHex(team.color)) || DEFAULT_ACCENT;
  // ADR-019 (Task 10): a team context whose roster hasn't confirmed it yet still gets DEFAULT_ACCENT
  // above (colors must always be a valid palette) — but that reads as personal. accentConfirmed lets
  // chrome consumers tell the two apart without this hook doing any extra fetch/subscription work.
  const accentConfirmed = teamId == null || !!team;

  return { colors: makeColors(scheme, accent), scheme, accent, accentConfirmed };
};
