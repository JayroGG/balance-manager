import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats a decimal with the default currency (USD)', () => {
    const out = formatMoney(1234.5);
    // Don't assert exact Intl symbol/spacing (ICU-dependent: '$' vs 'USD') — assert the meaningful parts:
    // the amount is grouped to 2 decimals and a currency marker (symbol or code) is present.
    expect(out).toContain('1,234.50');
    expect(out).toMatch(/\$|USD/);
  });

  it('treats null / undefined as 0', () => {
    expect(formatMoney(null)).toContain('0.00');
    expect(formatMoney(undefined)).toContain('0.00');
  });

  it('formats with an explicit currency', () => {
    expect(formatMoney(10, 'EUR')).toContain('10.00');
  });

  it('coerces numeric strings', () => {
    expect(formatMoney('19.99')).toContain('19.99');
  });

  it('falls back to "<currency> <value>" when the currency code is invalid', () => {
    // A malformed (too-short) code makes Intl.NumberFormat throw → the catch branch runs.
    expect(formatMoney(12, 'XX')).toBe('XX 12.00');
    expect(formatMoney(null, 'XX')).toBe('XX 0.00');
  });
});
