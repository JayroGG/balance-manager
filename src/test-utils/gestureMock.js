// Shared jest mock for react-native-gesture-handler's Gesture API (jest.mock('react-native-gesture-handler',
// () => require('<rel>/test-utils/gestureMock'))). `handlers` collects the callbacks of the last pan
// (onStart/onUpdate/onEnd/onFinalize) so a test can drive it.
const handlers = {};
const chain = new Proxy(
  {},
  {
    get: (_, name) => (fn) => {
      if (typeof fn === 'function') handlers[name] = fn;
      else if (name === 'enabled') handlers.__enabled = fn;

      return chain;
    },
  },
);
module.exports = {
  __esModule: true,
  Gesture: { Pan: () => chain },
  GestureDetector: ({ children }) => children,
  GestureHandlerRootView: ({ children }) => children,
  __handlers: handlers,
};
