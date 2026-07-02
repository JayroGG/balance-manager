import { contrastOn } from '../utils/colors';

// Theme tokens (ADR-013). Colors are DYNAMIC: components read them via useTheme() — there is no
// static `colors` export. `primary`/`primaryText` are accent-derived in makeColors (active team's
// color, or the default in personal context). spacing/radius/font are theme-invariant and stay
// static imports.

const light = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  text: '#16181D',
  muted: '#6B7280',
  danger: '#DC2626',
  success: '#16A34A',
  border: '#E5E7EB',
  incomeBg: '#DCFCE7',
  incomeText: '#166534',
  expenseBg: '#FEE2E2',
  expenseText: '#991B1B',
};

const dark = {
  bg: '#0F1115',
  card: '#1A1D23',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  danger: '#F87171',
  success: '#4ADE80',
  border: '#2A2E37',
  incomeBg: '#14321F',
  incomeText: '#86EFAC',
  expenseBg: '#3B1519',
  expenseText: '#FCA5A5',
};

export const DEFAULT_ACCENT = '#2563EB';

// The 10 preset swatches offered on team create/edit (custom hex is also allowed).
export const PRESET_TEAM_COLORS = [
  '#2563EB', // blue (default)
  '#0D9488', // teal
  '#16A34A', // green
  '#D97706', // amber
  '#EA580C', // orange
  '#DC2626', // red
  '#DB2777', // pink
  '#7C3AED', // violet
  '#4F46E5', // indigo
  '#475569', // slate
];

// Pure: scheme ('light' | 'dark') + accent hex → the full color set. contrastOn keeps text on the
// accent readable for any custom hex.
export const makeColors = (scheme, accent = DEFAULT_ACCENT) => ({
  ...(scheme === 'dark' ? dark : light),
  primary: accent,
  primaryText: contrastOn(accent),
});

export const spacing = (n) => n * 8;

export const radius = { sm: 8, md: 12, lg: 20 };

export const font = { sm: 13, md: 15, lg: 18, xl: 24, hero: 34 };
