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

export const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && DateTime.fromISO(s).isValid;

// Order a custom range so from <= to (a swapped pair is a typo, not an error). Returns null when
// neither bound is a valid date; a single valid bound yields an open-ended range.
export const normalizeRange = (from, to) => {
  const f = isISODate(from) ? from : undefined;
  const t = isISODate(to) ? to : undefined;
  if (!f && !t) return null;
  if (f && t && f > t) return { from: t, to: f };
  return { from: f, to: t };
};

// Compact range label: "Nov 1–14", "Oct 28 – Nov 3", "3 Nov 2025 – 8 Jan 2026"; open ends read "From …" / "Until …"
// via the caller's strings. Locale-aware through luxon.
export const formatRange = ({ from, to }, locale, { fromLabel = 'From', untilLabel = 'Until' } = {}) => {
  const fmt = (iso, opts) => DateTime.fromISO(iso).setLocale(locale).toLocaleString(opts);
  const full = { day: 'numeric', month: 'short', year: 'numeric' };
  if (from && to) {
    if (from === to) return fmt(from, full);
    const a = DateTime.fromISO(from);
    const b = DateTime.fromISO(to);
    if (a.year !== b.year) return `${fmt(from, full)} – ${fmt(to, full)}`;
    // Same month: swap the end day for "start–end" so the locale's own order and numerals survive.
    if (a.month === b.month) {
      return b
        .setLocale(locale)
        .toLocaleParts({ day: 'numeric', month: 'short' })
        .map((part) => (part.type === 'day' ? `${a.setLocale(locale).toLocaleParts({ day: 'numeric' })[0].value}–${part.value}` : part.value))
        .join('');
    }
    return `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short' })}`;
  }
  return from ? `${fromLabel} ${fmt(from, full)}` : `${untilLabel} ${fmt(to, full)}`;
};

// "Mar 2026" for the active Months chip.
export const formatMonthYear = (year, month, locale) =>
  DateTime.fromObject({ year, month, day: 1 }).setLocale(locale).toLocaleString({ month: 'short', year: 'numeric' });

// Years offered by the Months picker, newest first: this year back `span` years.
export const monthPickerYears = (now = DateTime.now(), span = 4) =>
  Array.from({ length: span + 1 }, (_, i) => now.year - i);

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
