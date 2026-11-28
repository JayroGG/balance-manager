import { pickGlassKind } from './GlassSurface';

describe('pickGlassKind', () => {
  it('uses solid whenever Reduce Transparency is on', () => {
    expect(pickGlassKind({ reduceTransparency: true, liquid: true })).toBe('solid');
    expect(pickGlassKind({ reduceTransparency: true, liquid: false, flat: true })).toBe('solid');
  });
  it('flat surfaces (rotating faces) never carry a native blur/glass: wash only', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: true, flat: true })).toBe('wash');
  });
  it('uses liquid glass when available (iOS 26+)', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: true })).toBe('liquid');
  });
  it('falls back to blur (Android / older iOS)', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: false })).toBe('blur');
  });
  it('falls back to a wash when the native blur is missing (old dev client)', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: false, blurAvailable: false })).toBe('wash');
  });
});

describe('pickGlassKind on Android (ADR-028)', () => {
  it('uses the crystal surface: no native blur, flat or not', () => {
    expect(pickGlassKind({ reduceTransparency: false, liquid: false, android: true })).toBe('crystal');
    expect(pickGlassKind({ reduceTransparency: false, liquid: false, flat: true, android: true })).toBe('crystal');
    expect(pickGlassKind({ reduceTransparency: false, liquid: false, blurAvailable: false, android: true })).toBe('crystal');
  });
  it('Reduce Transparency still wins with the solid card color', () => {
    expect(pickGlassKind({ reduceTransparency: true, liquid: false, android: true })).toBe('solid');
  });
});
