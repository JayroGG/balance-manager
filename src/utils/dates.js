import { DateTime, Info } from 'luxon';

// occurred_at is a date (YYYY-MM-DD); created_at/updated_at are ISO-8601 UTC. (PRD §4)
export const todayISODate = () => DateTime.now().toISODate();

// Localized short month names (Jan…Dec), index 0 = January — for the transactions Months picker (ADR-021).
export const monthShortNames = (locale) => Info.months('short', { locale });

export const formatDate = (iso) =>
  iso ? DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED) : '';

export const formatDateTime = (iso) =>
  iso ? DateTime.fromISO(iso, { zone: 'utc' }).toLocal().toLocaleString(DateTime.DATETIME_MED) : '';

// Relative feed timestamps ("3 hours ago"), locale-aware; created_at is ISO-8601 UTC (ADR-017).
export const timeAgo = (iso, locale) =>
  iso ? DateTime.fromISO(iso, { zone: 'utc' }).toRelative({ locale }) : '';

// Relative time from an epoch-millis timestamp ("2h ago") — RTK Query's fulfilledTimeStamp is millis,
// not ISO, so it needs its own conversion. Used by StaleBadge (ADR-019).
export const timeAgoMillis = (millis, locale) =>
  millis ? DateTime.fromMillis(millis).toRelative({ locale }) : '';

// ── Transactions date filter (ADR-021) ──────────────────────────────────────────────────────────
// Ranges are resolved from the DEVICE-LOCAL calendar date (DateTime.now() is local) and serialized
// with toISODate() — never `toISOString().slice(0, 10)`, which is UTC and flips the day near midnight.
// `now` is injectable so the maths is testable without faking the clock.

export const DATE_PRESETS = ['all', 'today', 'yesterday', 'week'];

// preset → { from, to } (inclusive YYYY-MM-DD). 'all' → {} (no bound). Week starts Monday, today inclusive.
export const presetRange = (preset, now = DateTime.now()) => {
  const today = now.startOf('day');
  switch (preset) {
    case 'today':
      return { from: today.toISODate(), to: today.toISODate() };
    case 'yesterday': {
      const y = today.minus({ days: 1 }).toISODate();
      return { from: y, to: y };
    }
    case 'week':
      return { from: today.startOf('week').toISODate(), to: today.toISODate() };
    default:
      return {};
  }
};

// First..last day of a calendar month (month is 1-12); leap Februaries handled by luxon.
export const monthRange = (year, month) => {
  const first = DateTime.fromObject({ year, month, day: 1 });
  return { from: first.toISODate(), to: first.endOf('month').toISODate() };
};

// Compact range label: "Nov 1–14", "Oct 28 – Nov 3", "3 Nov 2025 – 8 Jan 2026". Both bounds required (ranges are always closed). Locale-aware through luxon.
export const formatRange = ({ from, to }, locale) => {
  const fmt = (iso, opts) => DateTime.fromISO(iso).setLocale(locale).toLocaleString(opts);
  const full = { day: 'numeric', month: 'short', year: 'numeric' };
  const short = { day: 'numeric', month: 'short' };
  if (from === to) return fmt(from, full);
  const a = DateTime.fromISO(from).setLocale(locale);
  const b = DateTime.fromISO(to).setLocale(locale);
  if (a.year !== b.year) return `${fmt(from, full)} – ${fmt(to, full)}`;
  // Same month: swap the end day for "start–end" so the locale's own order and numerals survive.
  if (a.month === b.month) {
    const startDay = a.toLocaleParts({ day: 'numeric' })[0].value;
    return b
      .toLocaleParts(short)
      .map((part) => (part.type === 'day' ? `${startDay}–${part.value}` : part.value))
      .join('');
  }
  return `${fmt(from, short)} – ${fmt(to, short)}`;
};

// "Mar 2026" for the active Months chip.
export const formatMonthYear = (year, month, locale) =>
  DateTime.fromObject({ year, month, day: 1 }).setLocale(locale).toLocaleString({ month: 'short', year: 'numeric' });

// Resolve the Transactions date-filter state to the { from, to } sent to the server.
// state: { kind: 'all'|'today'|'yesterday'|'week'|'month'|'custom', year?, month?, from?, to? }
export const filterRange = (state, now = DateTime.now()) => {
  switch (state.kind) {
    case 'month':
      return monthRange(state.year, state.month);
    case 'custom':
      return { from: state.from, to: state.to };
    default:
      return presetRange(state.kind, now);
  }
};

// ── Calendar helpers for the Custom range picker + Months picker (ADR-021) ──────────────────────

// Weeks (Monday first) of a calendar month as rows of 7 cells: an ISO date, or null for the padding
// before the 1st / after the last day. month is 1-12.
export const monthGrid = (year, month) => {
  const first = DateTime.fromObject({ year, month, day: 1 });
  const cells = Array(first.weekday - 1).fill(null);
  for (let d = 1; d <= first.daysInMonth; d++) cells.push(first.set({ day: d }).toISODate());
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
};

// Short weekday labels, Monday first, localized.
export const weekdayLabels = (locale) => Info.weekdays('short', { locale });

// { year, month } shifted by `delta` months (rolls over year boundaries either way).
export const shiftMonth = ({ year, month }, delta) => {
  const d = DateTime.fromObject({ year, month, day: 1 }).plus({ months: delta });
  return { year: d.year, month: d.month };
};

export const formatMonthTitle = ({ year, month }, locale) =>
  DateTime.fromObject({ year, month, day: 1 }).setLocale(locale).toLocaleString({ month: 'long', year: 'numeric' });

// Range-selection state machine for the calendar. state = { start, end } (ISO or null).
//   no start, or a complete range → this tap starts a new range
//   start only → this tap ends it; before the start swaps them; the same day is a single-day range
export const pickRangeDay = ({ start, end }, iso) => {
  if (!start || end) return { start: iso, end: null };
  return iso < start ? { start: iso, end: start } : { start, end: iso };
};

// Is `iso` strictly between the selected bounds (for the in-range highlight)?
export const isBetween = ({ start, end }, iso) => !!start && !!end && iso > start && iso < end;
