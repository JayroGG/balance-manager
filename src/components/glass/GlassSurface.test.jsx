import { pickGlassKind } from './GlassSurface';

describe('pickGlassKind', () => {
  it('uses solid whenever Reduce Transparency is on', () => {
    expect(pickGlassKind({ reduceTransparency: true, liquid: true })).toBe('solid');
    expect(pickGlassKind({ reduceTransparency: true, liquid: false })).toBe('solid');
  });
  it('uses liquid glass when available (iOS 26+)', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: true })).toBe('liquid');
  });
  it('falls back to blur (Android / older iOS)', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: false })).toBe('blur');
  });
});
