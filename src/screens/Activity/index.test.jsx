// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (mirrors endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

// Identity-ish stub (mirrors utils/activity.test.js): a missing-translation key is returned as-is when
// there are no interpolation values, and as `key {json}` when there are — deterministic assertions
// without loading real i18n resources.
const stubT = (key, vals) => (vals ? [key, JSON.stringify(vals)].join(' ') : key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stubT, i18n: { language: 'en' } }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../hooks/useIdToken', () => ({ useIdToken: () => 'fake-token' }));
jest.mock('../../utils/jwt', () => ({
  decodeUser: (token) => (token === 'fake-token' ? { id: 1, email: 'me@test.com' } : null),
}));
jest.mock('../../services/api/balance', () => ({
  useGetBalanceQuery: () => ({ data: { currency: 'USD' } }),
}));

const mockUseGetEventsQuery = jest.fn();
jest.mock('../../services/api/events', () => ({
  useGetEventsQuery: (...args) => mockUseGetEventsQuery(...args),
}));

import { renderWithStore, screen } from '../../test-utils/renderWithStore';
import Activity from './index';

const OWN_EVENT = {
  id: 5,
  user_id: 1,
  actor_email: 'me@test.com',
  entity: 'vault',
  action: 'created',
  entity_id: 3,
  summary: { name: 'Rainy day' },
  created_at: '2026-07-15T10:00:00.000Z',
};
const OTHER_EVENT = {
  id: 4,
  user_id: 42,
  actor_email: 'ana@test.com',
  entity: 'transaction',
  action: 'created',
  entity_id: 9,
  summary: { description: 'Coffee', amount: 5, type: 'expense' },
  created_at: '2026-07-15T09:00:00.000Z',
};

beforeEach(() => {
  mockUseGetEventsQuery.mockReset();
});

it('renders both own and other-actor rows, own row uses the "You" label', () => {
  mockUseGetEventsQuery.mockReturnValue({
    data: [OWN_EVENT, OTHER_EVENT],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });

  renderWithStore(<Activity />);

  expect(screen.getByText(/activity\.you/)).toBeTruthy();
  expect(screen.getByText(/ana@test\.com/)).toBeTruthy();
});

it('marks the feed seen — store lastSeen for the context becomes the top event id', () => {
  mockUseGetEventsQuery.mockReturnValue({
    data: [OWN_EVENT, OTHER_EVENT],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });

  const { store } = renderWithStore(<Activity />);

  expect(store.getState().activity.lastSeen.personal).toBe(OWN_EVENT.id);
});

it('shows the empty state when the feed has no events', () => {
  mockUseGetEventsQuery.mockReturnValue({ data: [], isLoading: false, error: null, refetch: jest.fn() });

  renderWithStore(<Activity />);

  expect(screen.getByText('activity.empty')).toBeTruthy();
});
