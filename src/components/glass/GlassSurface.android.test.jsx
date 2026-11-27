jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-glass-effect', () => ({ GlassView: 'GlassView', isLiquidGlassAvailable: () => false }));
jest.mock('./glassSupport', () => ({
  ...jest.requireActual('./glassSupport'),
  useReduceTransparency: jest.fn(() => false),
}));

import { Platform, StyleSheet, Text } from 'react-native';
import { renderWithStore as render, screen } from '../../test-utils/renderWithStore';
import { GlassSurface } from './GlassSurface';
import { useReduceTransparency } from './glassSupport';
import { makeColors } from '../theme';

const flat = (id) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('GlassSurface on Android', () => {
  const os = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = os;
  });
  it('renders the crystal surface with an accent-lit rim and no BlurView', () => {
    const { UNSAFE_queryAllByType } = render(<GlassSurface testID="g" flat under={<Text>under</Text>}><Text>x</Text></GlassSurface>);
    const s = flat('g');
    expect(screen.getByTestId('g').props.nativeID).toBe('glass-crystal');
    expect(s.borderWidth).toBe(1.5);
    expect(s.borderTopColor).not.toBe(s.borderBottomColor);
    expect(screen.queryByText('under')).toBeNull(); // GlassFill's blur layer is never mounted
    expect(UNSAFE_queryAllByType('BlurView')).toHaveLength(0);
  });
  it('turns the whole rim to danger when overdrawn', () => {
    render(<GlassSurface testID="g" flat danger><Text>x</Text></GlassSurface>);
    const s = flat('g');
    const danger = makeColors('light', '#2563EB').danger;
    expect([s.borderTopColor, s.borderLeftColor, s.borderRightColor, s.borderBottomColor]).toEqual([danger, danger, danger, danger]);
  });
  it('falls back to the solid card color with Reduce Transparency', () => {
    useReduceTransparency.mockReturnValue(true);
    render(<GlassSurface testID="g" flat><Text>x</Text></GlassSurface>);
    expect(screen.getByTestId('g').props.nativeID).toBe('glass-solid');
    useReduceTransparency.mockReturnValue(false);
  });
});
