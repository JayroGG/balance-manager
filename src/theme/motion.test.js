jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
  AndroidHaptics: { Context_Click: 'context-click', Gesture_Start: 'gesture-start', Gesture_End: 'gesture-end' },
}));

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { dropHaptic, liftHaptic, tapHaptic } from './motion';

const os = Platform.OS;
afterEach(() => {
  Platform.OS = os;
  jest.clearAllMocks();
});

describe('haptics are short and light', () => {
  it('Android: the platform light effects, never impactAsync', () => {
    Platform.OS = 'android';
    tapHaptic();
    liftHaptic();
    dropHaptic();
    expect(Haptics.performAndroidHapticsAsync.mock.calls.map((c) => c[0])).toEqual(['context-click', 'gesture-start', 'gesture-end']);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
  it('iOS: Light for tap/lift, Soft for the drop; never Medium', () => {
    Platform.OS = 'ios';
    tapHaptic();
    liftHaptic();
    dropHaptic();
    expect(Haptics.impactAsync.mock.calls.map((c) => c[0])).toEqual(['light', 'light', 'soft']);
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
  it('Android below API 30 (platform effect rejects): falls back to a light impact', async () => {
    Platform.OS = 'android';
    Haptics.performAndroidHapticsAsync.mockImplementationOnce(() => Promise.reject(new Error('unsupported')));
    liftHaptic();
    await Promise.resolve();
    await Promise.resolve();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });
  it('never throws when haptics reject or are unavailable', () => {
    Platform.OS = 'android';
    Haptics.performAndroidHapticsAsync.mockImplementationOnce(() => Promise.reject(new Error('no')));
    expect(() => tapHaptic()).not.toThrow();
    Haptics.performAndroidHapticsAsync.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => liftHaptic()).not.toThrow();
  });
});
