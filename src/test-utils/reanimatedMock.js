// Shared jest mock for react-native-reanimated (jest.mock('react-native-reanimated', () =>
// require('<rel>/test-utils/reanimatedMock'))). Values resolve immediately; styles are evaluated lazily.
const React = require('react');
const { View } = require('react-native');

// Re-evaluates `transform` on every read (SortableList tests watch it move); other keys are read once.
const lazyStyle = (f) => {
  const { transform, ...rest } = f();
  return Object.defineProperty({ ...rest }, 'transform', { get: () => f().transform, enumerable: true });
};

module.exports = {
  __esModule: true,
  default: { View },
  useSharedValue: (v) => React.useRef({ value: v }).current,
  useAnimatedStyle: (f) => lazyStyle(f),
  useDerivedValue: (f) => ({ get value() { return f(); } }),
  useReducedMotion: () => module.exports.__reduce.value,
  __reduce: { value: false },
  interpolate: (x, [a, b], [c, d]) => c + ((x - a) / (b - a)) * (d - c),
  withSpring: (v) => v,
  withTiming: (v) => v,
  withDelay: (_ms, v) => v,
  Easing: { out: (f) => f, cubic: 1 },
};
