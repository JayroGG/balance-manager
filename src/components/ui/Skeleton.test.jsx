import { renderWithStore as render, screen } from '../../test-utils/renderWithStore';
import { Skeleton } from './Skeleton';

// Behaviour-only: renders as an announced progress indicator, and unmounts cleanly (the animation loop
// must stop on cleanup — an unstopped loop leaks on every list re-render, ADR-019).
describe('Skeleton', () => {
  it('renders a progressbar', () => {
    render(<Skeleton />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('unmounts without warning', () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<Skeleton />);
    unmount();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
