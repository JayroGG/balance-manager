jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
jest.mock('../../services/api/users', () => ({ ...jest.requireActual('../../services/api/users'), useGetMeQuery: jest.fn(), useUpdateMeMutation: jest.fn() }));
jest.mock('../../services/api/teams', () => ({ ...jest.requireActual('../../services/api/teams'), useGetTeamsQuery: jest.fn(), useCreateTeamMutation: jest.fn() }));
const mockPush = jest.fn();

import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithStore, screen } from '../../test-utils/renderWithStore';
import { useGetMeQuery, useUpdateMeMutation } from '../../services/api/users';
import { useGetTeamsQuery, useCreateTeamMutation } from '../../services/api/teams';
import PersonalScreen from './PersonalScreen';
import TeamsList from './ListScreen';

const update = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
beforeEach(() => {
  update.mockClear();
  mockPush.mockClear();
  useUpdateMeMutation.mockReturnValue([update, { isLoading: false }]);
  useGetTeamsQuery.mockReturnValue({ data: [], isLoading: false });
  useCreateTeamMutation.mockReturnValue([jest.fn(), { isLoading: false }]);
});

describe('PersonalScreen', () => {
  it('saves a picked color to the account', async () => {
    useGetMeQuery.mockReturnValue({ data: { id: 1, email: 'a@b.c', color: null } });
    renderWithStore(<PersonalScreen />);
    expect(screen.queryByText('common.save')).toBeNull();
    fireEvent.press(screen.getByTestId('swatch-#16A34A'));
    fireEvent.press(screen.getByText('common.save'));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ color: '#16A34A' }));
  });
  it('offers a Default choice, selected when the account color is null, with no pending save', () => {
    useGetMeQuery.mockReturnValue({ data: { id: 1, email: 'a@b.c', color: null } });
    renderWithStore(<PersonalScreen />);
    expect(screen.getByRole('checkbox', { name: 'teams.colorDefault' }).props.accessibilityState.checked).toBe(true);
    expect(screen.queryByText('common.save')).toBeNull();
  });
  it('picking Default sends color:null and is not selected while a color is saved', async () => {
    useGetMeQuery.mockReturnValue({ data: { id: 1, email: 'a@b.c', color: '#16A34A' } });
    renderWithStore(<PersonalScreen />);
    const chip = () => screen.getByRole('checkbox', { name: 'teams.colorDefault' });
    expect(chip().props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByText('teams.colorDefault'));
    expect(chip().props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByText('common.save'));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ color: null }));
  });
  it('labels the section Color, not Team color', () => {
    useGetMeQuery.mockReturnValue({ data: { id: 1, email: 'a@b.c', color: null } });
    renderWithStore(<PersonalScreen />);
    expect(screen.getByText('teams.personalColor')).toBeTruthy();
    expect(screen.queryByText('teams.color')).toBeNull();
  });
  it('has no rename, members or delete controls and survives a missing endpoint', () => {
    useGetMeQuery.mockReturnValue({ data: undefined, error: { status: 404 } });
    renderWithStore(<PersonalScreen />);
    expect(screen.queryByText('teams.rename')).toBeNull();
    expect(screen.queryByText('teams.members')).toBeNull();
    expect(screen.queryByText('teams.deleteTeam')).toBeNull();
  });
});

describe('Teams list Personal row', () => {
  it('shows a Personal row that opens the personal manage screen', () => {
    useGetMeQuery.mockReturnValue({ data: { id: 1, email: 'a@b.c', color: '#16A34A' } });
    renderWithStore(<TeamsList />);
    expect(screen.getByText('teams.personalName')).toBeTruthy();
    fireEvent.press(screen.getByTestId('personal-row'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/teams/personal');
  });
});
