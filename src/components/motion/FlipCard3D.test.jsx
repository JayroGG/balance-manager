jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));

import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { FlipCard3D } from './FlipCard3D';

const reanimated = require('react-native-reanimated');

const setup = (props) =>
  render(
    <FlipCard3D testID="card" front={<Text>front</Text>} back={<Text>back</Text>} {...props} />,
  );

afterEach(() => {
  reanimated.__reduce.value = false;
  jest.clearAllMocks();
});

it('asks to flip when the front is tapped, with a haptic', () => {
  const onFlip = jest.fn();
  setup({ flipped: false, onFlip });
  fireEvent.press(screen.getByTestId('card-front'));
  expect(onFlip).toHaveBeenCalledWith(true);
  expect(Haptics.impactAsync).toHaveBeenCalled();
});

it('asks to flip back when the back face is tapped', () => {
  const onFlip = jest.fn();
  setup({ flipped: true, onFlip });
  fireEvent.press(screen.getByTestId('card-back'));
  expect(onFlip).toHaveBeenCalledWith(false);
});

it('does not flip back when a tile inside the back face takes the touch', () => {
  const onFlip = jest.fn();
  const { Pressable } = require('react-native');
  setup({ flipped: true, onFlip, back: <Pressable testID="tile" onPress={() => {}}><Text>tile</Text></Pressable> });
  fireEvent.press(screen.getByTestId('tile'));
  expect(onFlip).not.toHaveBeenCalled();
});

it('only the visible face is interactive (controlled)', () => {
  const onFlip = jest.fn();
  setup({ flipped: true, onFlip });
  fireEvent.press(screen.getByTestId('card-front'));
  expect(onFlip).not.toHaveBeenCalled();
});

it('rotates in 3D normally, and uses a plain crossfade (no rotation) under Reduce Motion', () => {
  const { toJSON, unmount } = setup({ flipped: true, onFlip: jest.fn() });
  expect(JSON.stringify(toJSON())).toContain('perspective');
  unmount();
  reanimated.__reduce.value = true;
  const reduced = setup({ flipped: true, onFlip: jest.fn() });
  const json = JSON.stringify(reduced.toJSON());
  expect(json).not.toContain('perspective');
  expect(json).not.toMatch(/rotateY":"(?!0deg)/);
  expect(json).toContain('opacity');
});
