import { isValidHex, normalizeHex, contrastOn } from './colors';

describe('isValidHex', () => {
  it('accepts 6 hex digits with or without a leading #, any case', () => {
    expect(isValidHex('#2563EB')).toBe(true);
    expect(isValidHex('2563eb')).toBe(true);
    expect(isValidHex('#7c3AeD')).toBe(true);
  });

  it('rejects short/long forms, names, and garbage', () => {
    expect(isValidHex('#ABC')).toBe(false);
    expect(isValidHex('#2563EB0')).toBe(false);
    expect(isValidHex('purple')).toBe(false);
    expect(isValidHex('#25 3EB')).toBe(false);
    expect(isValidHex('')).toBe(false);
    expect(isValidHex(null)).toBe(false);
    expect(isValidHex(undefined)).toBe(false);
  });
});

describe('normalizeHex', () => {
  it('uppercases and prefixes #', () => {
    expect(normalizeHex('7c3aed')).toBe('#7C3AED');
    expect(normalizeHex('#7c3aed')).toBe('#7C3AED');
    expect(normalizeHex('#7C3AED')).toBe('#7C3AED');
  });

  it('returns null for invalid input', () => {
    expect(normalizeHex('purple')).toBeNull();
    expect(normalizeHex('#ABC')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
});

describe('contrastOn', () => {
  it('picks white text on dark accents', () => {
    expect(contrastOn('#2563EB')).toBe('#FFFFFF'); // default blue
    expect(contrastOn('#DC2626')).toBe('#FFFFFF'); // red
    expect(contrastOn('#475569')).toBe('#FFFFFF'); // slate
  });

  it('picks dark text on light accents', () => {
    expect(contrastOn('#FDE047')).toBe('#16181D'); // pale yellow
    expect(contrastOn('#FFFFFF')).toBe('#16181D');
  });

  it('falls back to white on invalid input', () => {
    expect(contrastOn(null)).toBe('#FFFFFF');
    expect(contrastOn('nope')).toBe('#FFFFFF');
  });
});
