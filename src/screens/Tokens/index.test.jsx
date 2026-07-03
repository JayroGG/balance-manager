// Absolute baseUrl so `new Request(url)` is valid under Node's fetch (see endpoints.test.js).
jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { Alert } from 'react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../../i18n/locales/en-US.json';
import { renderWithStore, fireEvent, screen } from '../../test-utils/renderWithStore';
import Tokens from './index';

const TOKENS = [
  { id: 3, name: 'iphone-shortcut', issued_at: '2026-07-03T00:00:00Z', expires_at: '2027-07-03T00:00:00Z' },
];

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const callsMatching = (fn) => global.fetch.mock.calls.filter(([req]) => fn(req));

beforeAll(() =>
  i18next.use(initReactI18next).init({
    resources: { 'en-US': { translation: enUS } },
    lng: 'en-US',
    interpolation: { escapeValue: false },
  }),
);

beforeEach(() => {
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    if (req.method === 'POST') {
      return Promise.resolve(jsonResponse({ id: 9, name: 'macro', token: 'jwt-secret-abc' }, 201));
    }
    if (req.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(jsonResponse(TOKENS));
  });
});

// Behaviour: list renders metadata (never a secret); minting reveals the secret once and
// dismisses; revoke confirms then DELETEs.
describe('Tokens', () => {
  it('lists active tokens by name', async () => {
    renderWithStore(<Tokens />);
    expect(await screen.findByText('iphone-shortcut')).toBeTruthy();
    expect(screen.queryByText(/jwt-secret/)).toBeNull();
  });

  it('mints a token and shows the secret once, until dismissed', async () => {
    renderWithStore(<Tokens />);
    await screen.findByText('iphone-shortcut');

    fireEvent.changeText(screen.getByPlaceholderText('iphone-shortcut'), 'macro');
    fireEvent.press(screen.getByText('Create token'));

    expect(await screen.findByText('jwt-secret-abc')).toBeTruthy();
    const mint = callsMatching((r) => r.method === 'POST');
    expect(mint).toHaveLength(1);
    await expect(mint[0][0].clone().json()).resolves.toEqual({ name: 'macro' });

    fireEvent.press(screen.getByText('Done'));
    expect(screen.queryByText('jwt-secret-abc')).toBeNull();
  });

  it('revokes after confirmation', async () => {
    // Auto-press the destructive action in the confirm dialog.
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    renderWithStore(<Tokens />);
    await screen.findByText('iphone-shortcut');

    fireEvent.press(screen.getByTestId('revoke-3'));
    await screen.findByText('iphone-shortcut'); // settle
    await Promise.resolve();
    expect(callsMatching((r) => r.method === 'DELETE' && /\/auth\/tokens\/3$/.test(r.url))).toHaveLength(1);
  });
});
