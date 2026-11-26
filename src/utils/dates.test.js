import { Settings } from 'luxon';
import { DateTime } from 'luxon';
import {
  todayISODate, formatDate, formatDateTime, monthShortNames, timeAgo,
  presetRange, monthRange, filterRange, formatRange, formatMonthYear,
  monthGrid, weekdayLabels, shiftMonth, formatMonthTitle, pickRangeDay, isBetween,
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
    expect(formatRange({ from: '2026-11-01', to: '2026-11-14' }, 'es-MX')).toMatch(/^1–14 nov/);
    expect(formatRange({ from: '2026-10-28', to: '2026-11-03' }, 'en-US')).toBe('Oct 28 – Nov 3');
    expect(formatRange({ from: '2025-11-03', to: '2026-01-08' }, 'en-US')).toBe('Nov 3, 2025 – Jan 8, 2026');
    expect(formatRange({ from: '2026-11-03', to: '2026-11-03' }, 'en-US')).toBe('Nov 3, 2026');
  });

  it('formatMonthYear / formatMonthTitle', () => {
    expect(formatMonthYear(2026, 3, 'en-US')).toBe('Mar 2026');
    expect(formatMonthTitle({ year: 2026, month: 3 }, 'en-US')).toBe('March 2026');
  });
});

describe('monthGrid', () => {
  const flat = (g) => g.flat().filter(Boolean);

  it('is Monday-first: Nov 2026 starts on a Sunday → 6 leading blanks', () => {
    const g = monthGrid(2026, 11);
    expect(g[0].slice(0, 6)).toEqual(Array(6).fill(null));
    expect(g[0][6]).toBe('2026-11-01');
    expect(flat(g)).toHaveLength(30);
  });

  it('a month starting on Monday has no leading blanks (Jun 2026)', () => {
    expect(monthGrid(2026, 6)[0][0]).toBe('2026-06-01');
  });

  it('rows are always 7 wide; trailing cells pad to the week', () => {
    monthGrid(2026, 11).forEach((w) => expect(w).toHaveLength(7));
    const g = monthGrid(2026, 11);
    expect(g.at(-1).at(-1)).toBeNull(); // Nov 30 is a Monday
    expect(g.at(-1)[0]).toBe('2026-11-30');
  });

  it('February: 28 / 29 days, and 4 rows when it fits exactly (Feb 2027 starts Monday)', () => {
    expect(flat(monthGrid(2026, 2))).toHaveLength(28);
    expect(flat(monthGrid(2024, 2))).toHaveLength(29);
    expect(monthGrid(2027, 2)).toHaveLength(4);
  });

  it('a 31-day month starting Saturday/Sunday needs 6 rows (Aug 2026 starts Saturday)', () => {
    expect(monthGrid(2026, 8)).toHaveLength(6);
  });

  it('every cell is a real, ordered ISO date', () => {
    const days = flat(monthGrid(2026, 3));
    expect(days).toEqual([...days].sort());
    expect(days[0]).toBe('2026-03-01');
    expect(days.at(-1)).toBe('2026-03-31');
  });
});

describe('weekdayLabels / shiftMonth', () => {
  it('weekday labels start on Monday', () => {
    expect(weekdayLabels('en-US')[0]).toBe('Mon');
    expect(weekdayLabels('en-US')).toHaveLength(7);
    expect(weekdayLabels('es-MX')[0].toLowerCase()).toMatch(/^lun/);
  });

  it('shiftMonth rolls over year boundaries both ways', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });
});

describe('pickRangeDay — first tap start, second tap end', () => {
  const none = { start: null, end: null };

  it('first tap sets only the start', () => {
    expect(pickRangeDay(none, '2026-11-10')).toEqual({ start: '2026-11-10', end: null });
  });

  it('second tap after the start completes the range', () => {
    expect(pickRangeDay({ start: '2026-11-10', end: null }, '2026-11-20')).toEqual({ start: '2026-11-10', end: '2026-11-20' });
  });

  it('second tap before the start swaps (tap 20 then 10 → 10..20)', () => {
    expect(pickRangeDay({ start: '2026-11-20', end: null }, '2026-11-10')).toEqual({ start: '2026-11-10', end: '2026-11-20' });
  });

  it('the same day twice is a single-day range', () => {
    expect(pickRangeDay({ start: '2026-11-10', end: null }, '2026-11-10')).toEqual({ start: '2026-11-10', end: '2026-11-10' });
  });

  it('a third tap starts a new range (also across months/years)', () => {
    expect(pickRangeDay({ start: '2026-11-10', end: '2026-11-20' }, '2027-01-02')).toEqual({ start: '2027-01-02', end: null });
  });

  it('works across a month boundary in either order', () => {
    expect(pickRangeDay({ start: '2026-12-05', end: null }, '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-12-05' });
  });
});

describe('isBetween', () => {
  const r = { start: '2026-11-10', end: '2026-11-20' };
  it('is exclusive of both ends and needs a complete range', () => {
    expect(isBetween(r, '2026-11-15')).toBe(true);
    expect(isBetween(r, '2026-11-10')).toBe(false);
    expect(isBetween(r, '2026-11-20')).toBe(false);
    expect(isBetween(r, '2026-11-21')).toBe(false);
    expect(isBetween({ start: '2026-11-10', end: null }, '2026-11-15')).toBe(false);
  });
});
