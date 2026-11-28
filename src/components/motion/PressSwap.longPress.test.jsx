jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { pressSwap as T } from '../../theme/motion';
import { PressSwap } from './PressSwap';

const Harness = () => {
  const [side, setSide] = useState('front');
  return <PressSwap testID="ps" side={side} onSwap={setSide} front={<Text>front</Text>} back={<Text>back</Text>} />;
};
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
// the opacity of every ancestor of the text multiplies: anything 0 means the card reads blank
const visible = (text) => {
  let n = screen.getByText(text);
  while (n) {
    const o = StyleSheet.flatten(n.props.style)?.opacity;
    if (o === 0) return false;
    n = n.parent;
  }
  return true;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Regression: a press held past the minimum sink+hold time released straight into rise() in the same tick as the
// swap; the side change (and the reveal setup) landed after it, so the real text stayed at opacity 0: a blank card.
it.each([300, 1000, 3000])('never ends blank after a %i ms hold', (holdMs) => {
  render(<Harness />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(holdMs);
  // RN's Pressability fires onPressOut BEFORE onPress on release; the swap's state update has not rendered yet
  fireEvent(press, 'pressOut');
  fireEvent(press, 'press');
  advance(T.riseMs + T.holdMs + 200);
  expect(screen.getByText('back')).toBeTruthy();
  expect(visible('back')).toBe(true);
});

it('a held press that turns into a scroll/cancel ends with the front content visible', () => {
  render(<Harness />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(1000);
  fireEvent(press, 'pressOut'); // no press: the scroll took the touch
  advance(T.riseMs + 200);
  expect(visible('front')).toBe(true);
});
