import { Settings } from 'luxon';
import { todayISODate, formatDate, formatDateTime, monthShortNames, timeAgo } from './dates';

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
