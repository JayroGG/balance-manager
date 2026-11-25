import { withQuery } from './queryString';

describe('withQuery', () => {
  it('returns the bare path when there is nothing to append', () => {
    expect(withQuery('/x')).toBe('/x');
    expect(withQuery('/x', {})).toBe('/x');
    expect(withQuery('/x', { a: undefined, b: null, c: '' })).toBe('/x');
  });

  it('appends provided values in order and keeps 0 / false', () => {
    expect(withQuery('/x', { a: 1, b: 'y', c: 0, d: false })).toBe('/x?a=1&b=y&c=0&d=false');
  });

  it('percent-encodes values', () => {
    expect(withQuery('/x', { q: 'a&b c%' })).toBe('/x?q=a%26b+c%25');
  });
});
