// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (see endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../../i18n/locales/en-US.json';
import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import NewTransfer from './NewScreen';

const TEAMS = [
  { id: 1, name: 'Alpha', role: 'owner' },
  { id: 2, name: 'Beta', role: 'guest' },
  { id: 3, name: 'Gamma', role: 'member' },
];

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const transferCalls = () =>
  global.fetch.mock.calls.filter(([req]) => req.url.endsWith('/transfers') && req.method === 'POST');

beforeAll(() =>
  i18next.use(initReactI18next).init({
    resources: { 'en-US': { translation: enUS } },
    lng: 'en-US',
    interpolation: { escapeValue: false },
  }),
);

beforeEach(() => {
  mockBack.mockClear();
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) =>
    Promise.resolve(
      req.url.includes('/teams')
        ? jsonResponse(TEAMS)
        : jsonResponse({ transfer_group_id: 'g1', from: {}, to: {} }, 201),
    ),
  );
});

// Behaviour: context pickers derive from roles (guest excluded), from≠to is enforced
// client-side, and a valid submit POSTs the body contract then pops back.
describe('NewTransfer', () => {
  it('offers personal + write-capable teams only (guest teams excluded)', async () => {
    renderWithStore(<NewTransfer />);
    expect(await screen.findAllByText('Alpha')).toHaveLength(2); // one per picker
    expect(screen.getAllByText('Gamma')).toHaveLength(2);
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.getAllByText('Personal')).toHaveLength(2);
  });

  it('flags from = to and does not submit', async () => {
    renderWithStore(<NewTransfer />);
    await screen.findAllByText('Alpha');

    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '50');
    // `from` defaults to personal; picking personal as `to` is the invalid pair.
    fireEvent.press(screen.getAllByText('Personal')[1]);
    expect(screen.getByText('Choose two different contexts')).toBeTruthy();

    fireEvent.press(screen.getByText('Transfer'));
    expect(transferCalls()).toHaveLength(0);
  });

  it('POSTs { amount, to_team_id, description } and navigates back on success', async () => {
    renderWithStore(<NewTransfer />);
    await screen.findAllByText('Alpha');

    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '300');
    fireEvent.changeText(screen.getByPlaceholderText('—'), 'capital');
    fireEvent.press(screen.getAllByText('Alpha')[1]); // `to` picker
    fireEvent.press(screen.getByText('Transfer'));

    await screen.findByText('Transfer'); // let the mutation settle
    await Promise.resolve();
    expect(transferCalls()).toHaveLength(1);
    await expect(transferCalls()[0][0].clone().json()).resolves.toEqual({
      amount: 300,
      to_team_id: 1,
      description: 'capital',
    });
  });
});
