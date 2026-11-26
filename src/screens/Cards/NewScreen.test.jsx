jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
const mockBack = jest.fn();
let mockParams = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ popToTop: jest.fn() }),
  Redirect: () => null,
}));

import './i18nTest';
import { waitFor } from '@testing-library/react-native';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import NewCard from './NewScreen';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const posts = () => global.fetch.mock.calls.map((c) => c[0]).filter((r) => r.method !== 'GET');

beforeEach(() => {
  mockParams = {};
  mockBack.mockReset();
  global.fetch.mockReset();
  global.fetch.mockImplementation((req) => {
    const { pathname } = new URL(req.url);
    if (req.method === 'POST') return Promise.resolve(jsonResponse({ id: 9 }, 201));
    if (req.method === 'PUT') return Promise.resolve(jsonResponse({ id: 1 }));
    if (pathname === '/cards/1') return Promise.resolve(jsonResponse({ id: 1, name: 'Visa', cut_day: 5, due_day: 25, credit_limit: 5000 }));
    return Promise.resolve(jsonResponse([]));
  });
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

it('rejects days outside 1..31, empty name and non-positive limit without posting', async () => {
  renderWithStore(<NewCard />);
  fireEvent.changeText(screen.getByPlaceholderText('5'), '32');
  fireEvent.changeText(screen.getByPlaceholderText('25'), '0');
  fireEvent.changeText(screen.getByPlaceholderText('0.00'), '-1');
  fireEvent.press(screen.getByText('Create'));
  expect(await screen.findByText('Name is required')).toBeTruthy();
  expect(screen.getAllByText('Enter a day from 1 to 31')).toHaveLength(2);
  expect(screen.getByText('Limit must be greater than 0')).toBeTruthy();
  expect(posts()).toHaveLength(0);
});

it('creates a card with an optional limit left empty as null', async () => {
  renderWithStore(<NewCard />);
  fireEvent.changeText(screen.getByPlaceholderText('Visa'), 'Visa');
  fireEvent.changeText(screen.getByPlaceholderText('5'), '5');
  fireEvent.changeText(screen.getByPlaceholderText('25'), '25');
  fireEvent.press(screen.getByText('Create'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  const body = JSON.parse(await posts()[0].clone().text());
  expect(body).toEqual({ name: 'Visa', cut_day: 5, due_day: 25, credit_limit: null });
});

it('edit mode seeds the form and PUTs', async () => {
  mockParams = { id: '1' };
  renderWithStore(<NewCard />);
  expect(await screen.findByDisplayValue('Visa')).toBeTruthy();
  expect(screen.getByDisplayValue('5000')).toBeTruthy();
  fireEvent.changeText(screen.getByDisplayValue('25'), '28');
  fireEvent.press(screen.getByText('Save'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  const put = posts()[0];
  expect(put.method).toBe('PUT');
  expect(JSON.parse(await put.clone().text()).due_day).toBe(28);
});
