import { act } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { renderWithStore as render, screen } from '../test-utils/renderWithStore';
import { AnimatedSplash } from './AnimatedSplash';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));

// Behaviour-only: it presents as a progress indicator, hides the native splash once its own
// frame is up, and reports completion so the caller can unmount it.
describe('AnimatedSplash', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders a progressbar and hides the native splash', async () => {
    render(<AnimatedSplash onDone={jest.fn()} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await act(async () => {}); // flush the mount effect's hideAsync await
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('calls onDone when the animation sequence finishes', async () => {
    const onDone = jest.fn();
    render(<AnimatedSplash onDone={onDone} />);
    await act(async () => {}); // let the sequence start (after hideAsync resolves)
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(10000); // spin + pop + spring + fade, with slack for the spring
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
