const { patchAppDelegate } = require('./withSceneLifecycle');

const TEMPLATE = `    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
`;

describe('withSceneLifecycle.patchAppDelegate', () => {
  it('removes the AppDelegate-owned window and RN start', () => {
    const out = patchAppDelegate(TEMPLATE);
    expect(out).not.toContain('UIWindow(frame');
    expect(out).not.toContain('startReactNative');
    expect(out).toContain('return super.application');
  });

  it('is idempotent', () => {
    const once = patchAppDelegate(TEMPLATE);
    expect(patchAppDelegate(once)).toBe(once);
  });

  it('throws when the template changed', () => {
    expect(() => patchAppDelegate('class AppDelegate {}')).toThrow(/template changed/);
  });
});
