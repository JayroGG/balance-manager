import { waitFor } from '@testing-library/react-native';
import { renderWithStore, screen, fireEvent } from '../../test-utils/renderWithStore';
import TransactionForm from './TransactionForm';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), Link: ({ children }) => children }));

const categories = [
  { id: 1, name: 'Food', kind: 'expense' },
  { id: 2, name: 'Home', kind: 'expense' },
  { id: 3, name: 'Salary', kind: 'income' },
];

it('toggles several category chips and submits category_ids (ADR-022)', async () => {
  const onSubmit = jest.fn().mockResolvedValue(true);
  renderWithStore(<TransactionForm categories={categories} onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByPlaceholderText('0.00'), '500');
  fireEvent.press(screen.getByText('Food'));
  fireEvent.press(screen.getByText('Home'));
  fireEvent.press(screen.getByText('common.save'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'expense', amount: 500, category_ids: [1, 2] });
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('category_id');
});

it('lets an expense larger than any available balance be submitted (no client cap)', async () => {
  const onSubmit = jest.fn().mockResolvedValue(true);
  renderWithStore(<TransactionForm categories={categories} onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByPlaceholderText('0.00'), '99999999');
  fireEvent.press(screen.getByText('common.save'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(onSubmit.mock.calls[0][0].amount).toBe(99999999);
});

it('edit mode: deselecting a tag marks the form dirty and sends the remaining set; clearing sends []', async () => {
  const onSubmit = jest.fn().mockResolvedValue(true);
  const initial = {
    type: 'expense', amount: 500, description: '', occurred_at: '2026-11-26',
    categories: [{ id: 1, name: 'Food' }, { id: 2, name: 'Home' }],
  };
  renderWithStore(<TransactionForm initial={initial} categories={categories} onSubmit={onSubmit} />);
  expect(screen.queryByText('common.save')).toBeNull(); // pristine → no Save
  fireEvent.press(screen.getByText('Home'));
  fireEvent.press(screen.getByText('common.save'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0].category_ids).toEqual([1]);
  fireEvent.press(screen.getByText('Food'));
  fireEvent.press(screen.getByText('common.save'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][0].category_ids).toEqual([]);
});

it('edit mode: re-ordering the same set is not a change', () => {
  const initial = {
    type: 'expense', amount: 500, description: '', occurred_at: '2026-11-26',
    categories: [{ id: 1, name: 'Food' }, { id: 2, name: 'Home' }],
  };
  renderWithStore(<TransactionForm initial={initial} categories={categories} onSubmit={jest.fn()} />);
  fireEvent.press(screen.getByText('Home'));
  fireEvent.press(screen.getByText('Home'));
  expect(screen.queryByText('common.save')).toBeNull();
});
