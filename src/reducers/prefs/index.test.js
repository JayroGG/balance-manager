import reducer, { setThemeMode, selectThemeMode } from './index';

describe('prefs reducer (ADR-013)', () => {
  it('defaults to the system theme', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.themeMode).toBe('system');
  });

  it.each(['system', 'light', 'dark'])('setThemeMode accepts %s', (mode) => {
    const state = reducer({ themeMode: 'system' }, setThemeMode(mode));
    expect(state.themeMode).toBe(mode);
  });

  it('ignores unknown modes', () => {
    const state = reducer({ themeMode: 'dark' }, setThemeMode('sepia'));
    expect(state.themeMode).toBe('dark');
  });
});

describe('prefs selector', () => {
  it('selectThemeMode reads the slice', () => {
    expect(selectThemeMode({ prefs: { themeMode: 'dark' } })).toBe('dark');
  });
});
