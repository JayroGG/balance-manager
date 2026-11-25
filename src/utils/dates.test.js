import { Settings } from 'luxon';
import { DateTime } from 'luxon';
import {
  todayISODate, formatDate, formatDateTime, monthShortNames, timeAgo,
  presetRange, monthRange, normalizeRange, isISODate, filterRange, formatRange, formatMonthYear, monthPickerYears,
} from './dates';

// Pin zone + locale so toLocaleString and the UTC→local conversion are deterministic across machines/CI.
beforeAll(() => {
  Settings.defaultZone = 'utc';
  Settings.defaultLocale = 'en-US';
});

describe('todayISODate', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('formats an ISO date as a medium date', () => {
    expect(formatDate('2026-06-27')).toBe('Jun 27, 2026');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
  });
});

describe('monthShortNames', () => {
  it('returns 12 localized short month names, January first', () => {
    const names = monthShortNames('en-US');
    expect(names).toHaveLength(12);
    expect(names[0]).toBe('Jan');
    expect(names[11]).toBe('Dec');
  });
});

describe('formatDateTime', () => {
  it('parses UTC and renders a medium date-time (UTC-pinned → local == UTC)', () => {
    const out = formatDateTime('2026-06-27T15:30:00Z');
    expect(out).toContain('Jun 27, 2026');
    expect(out).toContain('3:30');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });
});

describe('timeAgo', () => {
  it('returns a non-empty string for a recent ISO timestamp', () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(recent)).toEqual(expect.any(String));
    expect(timeAgo(recent)).not.toBe('');
  });

  it('returns empty string for falsy input', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
  });
});

// Fixed local instants — DateTime.local builds in the (pinned) default zone, i.e. "device local".
const at = (y, m, d, h = 12, min = 0) => DateTime.local(y, m, d, h, min);

describe('presetRange (ADR-021)', () => {
  it('all → no bounds', () => {
    expect(presetRange('all', at(2026, 3, 10))).toEqual({});
  });

  it('today / yesterday', () => {
    expect(presetRange('today', at(2026, 3, 10))).toEqual({ from: '2026-03-10', to: '2026-03-10' });
    expect(presetRange('yesterday', at(2026, 3, 10))).toEqual({ from: '2026-03-09', to: '2026-03-09' });
  });

  it('yesterday crosses month, year and leap-day boundaries', () => {
    expect(presetRange('yesterday', at(2026, 3, 1))).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(presetRange('yesterday', at(2024, 3, 1))).toEqual({ from: '2024-02-29', to: '2024-02-29' });
    expect(presetRange('yesterday', at(2026, 1, 1))).toEqual({ from: '2025-12-31', to: '2025-12-31' });
  });

  it('week starts Monday and includes today (mid-week)', () => {
    // Wed 2026-03-11 → Mon 2026-03-09
    expect(presetRange('week', at(2026, 3, 11))).toEqual({ from: '2026-03-09', to: '2026-03-11' });
  });

  it('week on a Monday is just that day; on a Sunday it spans the full Mon–Sun', () => {
    expect(presetRange('week', at(2026, 3, 9))).toEqual({ from: '2026-03-09', to: '2026-03-09' });
    expect(presetRange('week', at(2026, 3, 15))).toEqual({ from: '2026-03-09', to: '2026-03-15' });
  });

  it('week crosses a month and a year boundary', () => {
    expect(presetRange('week', at(2026, 4, 1))).toEqual({ from: '2026-03-30', to: '2026-04-01' }); // Wed
    expect(presetRange('week', at(2026, 1, 1))).toEqual({ from: '2025-12-29', to: '2026-01-01' }); // Thu
  });

  it('uses the local calendar date near midnight, not UTC', () => {
    expect(presetRange('today', at(2026, 3, 10, 23, 59))).toEqual({ from: '2026-03-10', to: '2026-03-10' });
    expect(presetRange('today', at(2026, 3, 10, 0, 1))).toEqual({ from: '2026-03-10', to: '2026-03-10' });
  });
});

describe('monthRange', () => {
  it('covers first..last day of the month', () => {
    expect(monthRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(monthRange(2026, 4)).toEqual({ from: '2026-04-01', to: '2026-04-30' });
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('handles February in common, leap and century years', () => {
    expect(monthRange(2026, 2).to).toBe('2026-02-28');
    expect(monthRange(2024, 2).to).toBe('2024-02-29');
    expect(monthRange(2100, 2).to).toBe('2100-02-28');
    expect(monthRange(2000, 2).to).toBe('2000-02-29');
  });
});

describe('isISODate / normalizeRange', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2026-03-10')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-3-1')).toBe(false);
    expect(isISODate('')).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it('keeps an ordered range, swaps a reversed one', () => {
    expect(normalizeRange('2026-03-01', '2026-03-20')).toEqual({ from: '2026-03-01', to: '2026-03-20' });
    expect(normalizeRange('2026-03-20', '2026-03-01')).toEqual({ from: '2026-03-01', to: '2026-03-20' });
    expect(normalizeRange('2026-03-05', '2026-03-05')).toEqual({ from: '2026-03-05', to: '2026-03-05' });
  });

  it('allows one open end and rejects two invalid bounds', () => {
    expect(normalizeRange('2026-03-01', '')).toEqual({ from: '2026-03-01', to: undefined });
    expect(normalizeRange('bad', '2026-03-09')).toEqual({ from: undefined, to: '2026-03-09' });
    expect(normalizeRange('bad', '')).toBeNull();
  });
});

describe('filterRange', () => {
  const now = at(2026, 3, 11);
  it('resolves each filter kind', () => {
    expect(filterRange({ kind: 'all' }, now)).toEqual({});
    expect(filterRange({ kind: 'today' }, now)).toEqual({ from: '2026-03-11', to: '2026-03-11' });
    expect(filterRange({ kind: 'month', year: 2024, month: 2 }, now)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(filterRange({ kind: 'custom', from: '2026-01-02', to: '2026-01-09' }, now)).toEqual({ from: '2026-01-02', to: '2026-01-09' });
  });
});

describe('labels', () => {
  it('formatRange compacts within a month, spans months, and spells out years', () => {
    expect(formatRange({ from: '2026-11-01', to: '2026-11-14' }, 'en-US')).toBe('Nov 1–14');
    expect(formatRange({ from: '2026-10-28', to: '2026-11-03' }, 'en-US')).toBe('Oct 28 – Nov 3');
    expect(formatRange({ from: '2025-11-03', to: '2026-01-08' }, 'en-US')).toBe('Nov 3, 2025 – Jan 8, 2026');
    expect(formatRange({ from: '2026-11-01', to: '2026-11-14' }, 'es-MX')).toMatch(/^1–14 nov/);
    expect(formatRange({ from: '2026-11-03', to: '2026-11-03' }, 'en-US')).toBe('Nov 3, 2026');
    expect(formatRange({ from: '2026-11-03' }, 'en-US', { fromLabel: 'From' })).toBe('From Nov 3, 2026');
    expect(formatRange({ to: '2026-11-03' }, 'en-US', { untilLabel: 'Until' })).toBe('Until Nov 3, 2026');
  });

  it('formatMonthYear and monthPickerYears', () => {
    expect(formatMonthYear(2026, 3, 'en-US')).toBe('Mar 2026');
    expect(monthPickerYears(at(2026, 6, 1), 2)).toEqual([2026, 2025, 2024]);
  });
});
