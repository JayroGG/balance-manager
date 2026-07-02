import { makeColors, DEFAULT_ACCENT, PRESET_TEAM_COLORS } from './theme';

describe('makeColors (ADR-013)', () => {
  it('applies the accent to primary and derives a readable primaryText', () => {
    const light = makeColors('light', '#7C3AED');
    expect(light.primary).toBe('#7C3AED');
    expect(light.primaryText).toBe('#FFFFFF'); // dark accent → white text

    const pale = makeColors('light', '#FDE047');
    expect(pale.primaryText).toBe('#16181D'); // light accent → dark text
  });

  it('defaults the accent when none is given', () => {
    expect(makeColors('light').primary).toBe(DEFAULT_ACCENT);
  });

  it('swaps surfaces between schemes but keeps the accent', () => {
    const light = makeColors('light', DEFAULT_ACCENT);
    const dark = makeColors('dark', DEFAULT_ACCENT);
    expect(dark.bg).not.toBe(light.bg);
    expect(dark.text).not.toBe(light.text);
    expect(dark.primary).toBe(light.primary);
  });

  it('ships 10 preset team colors', () => {
    expect(PRESET_TEAM_COLORS).toHaveLength(10);
    PRESET_TEAM_COLORS.forEach((hex) => expect(hex).toMatch(/^#[0-9A-F]{6}$/));
  });
});
