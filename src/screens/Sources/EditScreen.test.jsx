// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (see endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({}), // create mode
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../../i18n/locales/en-US.json';
import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import EditSource from './EditScreen';

const TEAMS = [
  { id: 1, name: 'Alpha', role: 'owner' },
  { id: 2, name: 'Beta', role: 'guest' },
];

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sourcePosts = () =>
  global.fetch.mock.calls.filter(([req]) => req.url.endsWith('/payment-sources') && req.method === 'POST');

beforeAll(() =>
  i18next.use(initReactI18next).init({
    resources: { 'en-US': { translation: enUS } },
    lng: 'en-US',
    interpolation: { escapeValue: false },
  }),
);

beforeEach(() => {
  mockReplace.mockClear();
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const { url } = req;
    if (url.endsWith('/payment-sources') && req.method === 'POST') {
      return Promise.resolve(jsonResponse({ id: 9, name: 'Nu account', type: 'account' }, 201));
    }
    if (url.includes('/teams')) return Promise.resolve(jsonResponse(TEAMS));
    return Promise.resolve(jsonResponse([]));
  });
});

// Behaviour: the routing picker derives from team roles (guest excluded); create POSTs the
// contract body and re-routes into edit mode for alias management.
describe('EditSource (create mode)', () => {
  it('offers personal + writable teams as routing targets, never guest teams', async () => {
    renderWithStore(<EditSource />);
    expect(await screen.findByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('creates the source with the picked routing rule and jumps into edit mode', async () => {
    renderWithStore(<EditSource />);
    await screen.findByText('Alpha');

    fireEvent.changeText(screen.getByPlaceholderText('Nu account'), 'Nu account');
    fireEvent.press(screen.getByText('Credit card'));
    fireEvent.press(screen.getByText('Alpha')); // route to the team
    fireEvent.press(screen.getByText('Save'));

    await screen.findByText('Save'); // settle
    await Promise.resolve();
    expect(sourcePosts()).toHaveLength(1);
    await expect(sourcePosts()[0][0].clone().json()).resolves.toEqual({
      name: 'Nu account',
      type: 'credit_card',
      bank: null,
      target_team_id: 1,
      default_category_id: null,
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(tabs)/settings/source',
      params: { id: 9 },
    });
  });
});
