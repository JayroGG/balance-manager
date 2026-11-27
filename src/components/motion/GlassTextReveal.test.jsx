jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedMock'));

import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GlassTextReveal } from './GlassTextReveal';

const sv = (value) => ({ value });

it('renders only the real content when inactive', () => {
  render(
    <GlassTextReveal active={false} ghost={sv(0)} real={sv(1)} blur={sv(4)}>
      <Text>hello</Text>
    </GlassTextReveal>,
  );
  expect(screen.getAllByText('hello', { includeHiddenElements: true })).toHaveLength(1);
});

it('while active it layers a ghost copy (hidden from a11y) under a frost and the real text', () => {
  render(
    <GlassTextReveal active ghost={sv(0.7)} real={sv(0)} blur={sv(4)} tint="light">
      <Text>hello</Text>
    </GlassTextReveal>,
  );
  const all = screen.getAllByText('hello', { includeHiddenElements: true });
  expect(all).toHaveLength(2); // ghost template + real text
  // queries (and screen readers) only ever see the real one
  expect(screen.getAllByText('hello')).toHaveLength(1);
});
