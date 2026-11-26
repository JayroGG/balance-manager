import { renderWithStore } from '../../test-utils/renderWithStore';
import { RangeCalendar } from './RangeCalendar';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

// Hermes returns narrow weekday names on device where Node returns 'Mon'..'Sun' — mock that shape.
const NARROW = { 'en-US': ['M', 'T', 'W', 'T', 'F', 'S', 'S'], 'es-MX': ['L', 'M', 'M', 'J', 'V', 'S', 'D'] };
jest.mock('../../utils/dates', () => ({
  ...jest.requireActual('../../utils/dates'),
  weekdayLabels: (locale) => NARROW[locale],
}));

// The narrow weekday names repeat (en: S M T W T F S, es: D L M M J V S), so they can't be React keys.
it.each(['en-US', 'es-MX'])('renders the weekday header without a duplicate-key warning (%s)', (locale) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  renderWithStore(<RangeCalendar value={{ start: null, end: null }} onChange={() => {}} locale={locale} />);
  const keyWarnings = spy.mock.calls.filter((c) => /same key|unique "key"/.test(c.map(String).join(' ')));
  spy.mockRestore();
  expect(keyWarnings).toEqual([]);
});
