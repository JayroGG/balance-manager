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
import Inbox from './index';

const PENDING = [
  {
    id: 5, channel: 'apple_pay', kind: 'purchase', direction: 'out', amount: 80,
    merchant_raw: 'OXXO', last4: '9999', captured_at: '2026-07-02T20:00:00Z', status: 'pending',
  },
];
const SOURCES = [{ id: 3, name: 'Nu account', type: 'account', target_team_id: null }];

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const callsTo = (path) => global.fetch.mock.calls.filter(([req]) => req.url.includes(path));

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
    const { url } = req;
    if (url.includes('/captures') && req.method === 'POST') {
      return Promise.resolve(jsonResponse({ ...PENDING[0], status: url.includes('confirm') ? 'posted' : 'discarded' }));
    }
    if (url.includes('/captures')) return Promise.resolve(jsonResponse(PENDING));
    if (url.includes('/payment-sources')) return Promise.resolve(jsonResponse(SOURCES));
    if (url.includes('/balance')) return Promise.resolve(jsonResponse({ total: 0, available: 0, vaults: [], currency: 'USD' }));
    return Promise.resolve(jsonResponse([]));
  });
});

// Behaviour: pending captures render with their evidence; linking one to a source
// POSTs /captures/:id/confirm with the picked source_id.
describe('Inbox', () => {
  it('renders the pending capture evidence', async () => {
    renderWithStore(<Inbox />);
    expect(await screen.findByText('OXXO')).toBeTruthy();
    expect(screen.getByText(/apple_pay/)).toBeTruthy();
    expect(screen.getByText(/9999/)).toBeTruthy();
  });

  it('link → pick source → confirm POSTs the review action', async () => {
    renderWithStore(<Inbox />);
    await screen.findByText('OXXO');

    fireEvent.press(screen.getByText('Link to source'));
    // Confirm is armed only after a source is picked.
    fireEvent.press(screen.getByText('Confirm'));
    expect(callsTo('/confirm')).toHaveLength(0);

    fireEvent.press(await screen.findByText('Nu account'));
    fireEvent.press(screen.getByText('Confirm'));

    await screen.findByText('OXXO'); // settle
    await Promise.resolve();
    expect(callsTo('/captures/5/confirm')).toHaveLength(1);
    await expect(callsTo('/captures/5/confirm')[0][0].clone().json()).resolves.toEqual({ source_id: 3 });
  });
});
