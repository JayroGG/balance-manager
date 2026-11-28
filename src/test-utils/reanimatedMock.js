// Shared jest mock for react-native-reanimated (jest.mock('react-native-reanimated', () =>
// require('<rel>/test-utils/reanimatedMock'))). Values resolve immediately; styles are evaluated lazily.
const React = require('react');
const { View } = require('react-native');

// Re-evaluates every key on each read (SortableList tests watch `transform` move; PressSwap tests watch `opacity`).
const lazyStyle = (f) => {
  const out = {};
  Object.keys(f()).forEach((k) => Object.defineProperty(out, k, { get: () => f()[k], enumerable: true }));
  return out;
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
