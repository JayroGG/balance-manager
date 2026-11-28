jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-glass-effect', () => ({ GlassView: 'GlassView', isLiquidGlassAvailable: () => false }));
jest.mock('./glassSupport', () => ({
  ...jest.requireActual('./glassSupport'),
  useReduceTransparency: jest.fn(() => false),
}));

import { Platform, StyleSheet, Text } from 'react-native';
import { renderWithStore as render, screen } from '../../test-utils/renderWithStore';
import { GlassSurface } from './GlassSurface';
import { crystalRim } from './CrystalSurface';
import { useReduceTransparency } from './glassSupport';
import { makeColors } from '../theme';

const flat = (id) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('crystalRim', () => {
  it('uses a stronger accent and a dimmer glint in dark mode, danger everywhere when overdrawn', () => {
    const light = crystalRim({ accent: '#2563EB', dark: false });
    const dark = crystalRim({ accent: '#2563EB', dark: true });
    expect(light.gradient).not.toBe(dark.gradient);
    expect(dark.gradient).toContain('rgba(37,99,235,0.7)');
    const bad = crystalRim({ accent: '#2563EB', danger: true, dangerColor: '#DC2626', dark: true });
    expect(bad.gradient).not.toContain('37,99,235');
  });
});

describe('GlassSurface on Android', () => {
  const os = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = os;
  });
  it('renders the crystal: a calm body inside a gradient rim, no BlurView, no GlassFill layer', () => {
    const { UNSAFE_queryAllByType } = render(<GlassSurface testID="g" flat under={<Text>under</Text>}><Text>x</Text></GlassSurface>);
    const outer = flat('g');
    const body = flat('g-body');
    expect(screen.getByTestId('g').props.nativeID).toBe('glass-crystal');
    expect(outer.experimental_backgroundImage).toMatch(/^linear-gradient\(135deg, rgba\(37,99,235/); // default accent sheen
    expect(outer.boxShadow).toHaveLength(1); // soft accent glow
    expect(body.experimental_backgroundImage).toBeUndefined(); // the body has no gradient
    expect(body.backgroundColor).toBe('rgba(255,255,255,0.96)');
    expect(screen.queryByText('under')).toBeNull();
    expect(UNSAFE_queryAllByType('BlurView')).toHaveLength(0);
  });
  it('a centred disc keeps its body full-size (no icon-wide slab) and fully round', () => {
    render(
      <GlassSurface testID="d" flat style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Text>i</Text>
      </GlassSurface>,
    );
    const body = flat('d-body');
    expect(body.alignSelf).toBe('stretch'); // else the outer alignItems:center shrinks the body to the icon's width
    expect(body.borderRadius).toBe(26.5);
    expect(body.alignItems).toBe('center');
    expect(body.justifyContent).toBe('center');
    expect(flat('d').borderRadius).toBe(28);
  });
  it('turns the rim sheen and glow to danger when overdrawn', () => {
    render(<GlassSurface testID="g" flat danger><Text>x</Text></GlassSurface>);
    const outer = flat('g');
    const danger = makeColors('light', '#2563EB').danger; // #DC2626
    expect(danger).toBe('#DC2626');
    expect(outer.experimental_backgroundImage).toContain('rgba(220,38,38');
    expect(outer.experimental_backgroundImage).not.toContain('rgba(37,99,235');
    expect(outer.boxShadow[0].color).toContain('rgba(220,38,38');
  });
  it('falls back to the solid card color with Reduce Transparency', () => {
    useReduceTransparency.mockReturnValue(true);
    render(<GlassSurface testID="g" flat><Text>x</Text></GlassSurface>);
    expect(screen.getByTestId('g').props.nativeID).toBe('glass-solid');
    useReduceTransparency.mockReturnValue(false);
  });
});
