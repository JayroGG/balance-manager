jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));

import { useState } from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { pressSwap as T } from '../../theme/motion';
import { PressSwap } from './PressSwap';

const reanimated = require('react-native-reanimated');

const Harness = ({ onSwap }) => {
  const [side, setSide] = useState('front');
  return (
    <PressSwap
      testID="ps"
      side={side}
      onSwap={(next) => {
        onSwap?.(next);
        setSide(next);
      }}
      front={<Text>front</Text>}
      back={<Text>back</Text>}
    />
  );
};

const tap = () => {
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  fireEvent(press, 'press');
  fireEvent(press, 'pressOut');
};
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  reanimated.__reduce.value = false;
  jest.clearAllMocks();
});

it('a quick tap swaps only at the bottom of the press, not on release', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  tap();
  expect(Haptics.impactAsync).toHaveBeenCalled();
  advance(T.sinkMs - 10);
  expect(onSwap).not.toHaveBeenCalled(); // still sinking, even though the finger is already up
  advance(20);
  expect(onSwap).toHaveBeenCalledWith('back');
  expect(screen.getByTestId('ps-back')).toBeTruthy();
});

it('holding keeps the card down; the swap lands on release, then it rises and accepts the next press', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(T.sinkMs + 500);
  expect(onSwap).not.toHaveBeenCalled(); // held: waits at the bottom
  fireEvent(press, 'press');
  fireEvent(press, 'pressOut');
  expect(onSwap).toHaveBeenCalledTimes(1);
  advance(T.holdMs + T.riseMs + 10);
  fireEvent(press, 'pressIn'); // idle again: the next press is accepted
  fireEvent(press, 'press');
  fireEvent(press, 'pressOut');
  advance(T.sinkMs + 10);
  expect(onSwap).toHaveBeenCalledTimes(2);
});

it('ignores presses while the sequence runs (rapid taps never half-swap or flicker)', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  tap();
  advance(30);
  tap();
  tap();
  advance(T.sinkMs + T.holdMs + T.riseMs + 50);
  expect(onSwap).toHaveBeenCalledTimes(1);
});

it('a press held at the bottom then dragged off (no tap) rises WITHOUT swapping', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(T.sinkMs + 300); // still down
  expect(onSwap).not.toHaveBeenCalled(); // a finger still down only waits at the bottom
  fireEvent(press, 'pressOut'); // released with no onPress
  advance(T.riseMs + 50);
  expect(onSwap).not.toHaveBeenCalled();
});

it('a hold released as a tap swaps on release, at the bottom', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(T.sinkMs + 300);
  fireEvent(press, 'press');
  expect(onSwap).toHaveBeenCalledWith('back');
});

it('a11y: the front is one button; on the back the tiles are reachable (no group) and the front is hidden', () => {
  render(<Harness />);
  expect(screen.getByTestId('ps-press').props.accessible).toBe(true);
  tap();
  advance(T.sinkMs + 10);
  const press = screen.getByTestId('ps-press');
  expect(press.props.accessible).toBe(false);
  expect(typeof press.props.onAccessibilityEscape).toBe('function');
  // the front is still mounted (it sizes the box) but hidden from screen readers
  const frontText = screen.getByText('front', { includeHiddenElements: true });
  let node = frontText;
  let hidden = false;
  while (node) {
    if (node.props?.importantForAccessibility === 'no-hide-descendants') hidden = true;
    node = node.parent;
  }
  expect(hidden).toBe(true);
});

it('a press that is cancelled before the bottom (a scroll took the touch) rises without swapping', () => {
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  advance(20);
  fireEvent(press, 'pressOut'); // no onPress: cancelled
  advance(T.sinkMs + T.riseMs + 50);
  expect(onSwap).not.toHaveBeenCalled();
});

it('Reduce Motion: no sink, a press swaps through a short crossfade', () => {
  reanimated.__reduce.value = true;
  const onSwap = jest.fn();
  render(<Harness onSwap={onSwap} />);
  const press = screen.getByTestId('ps-press');
  fireEvent(press, 'pressIn');
  fireEvent(press, 'press');
  fireEvent(press, 'pressOut');
  expect(onSwap).toHaveBeenCalledWith('back'); // immediately, not after a sink
  advance(T.crossfadeMs + 10);
  expect(screen.getByTestId('ps-back')).toBeTruthy();
});

it('an outside side change crossfades to the new side', () => {
  const { rerender } = render(
    <PressSwap testID="ps" side="back" front={<Text>front</Text>} back={<Text>back</Text>} />,
  );
  expect(screen.getByTestId('ps-back')).toBeTruthy();
  rerender(<PressSwap testID="ps" side="front" front={<Text>front</Text>} back={<Text>back</Text>} />);
  advance(T.crossfadeMs + 10);
  expect(screen.queryByTestId('ps-back')).toBeNull();
});
