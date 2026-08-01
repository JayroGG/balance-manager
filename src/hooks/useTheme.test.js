jest.mock('../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../services/api/baseApi';
import { teamsApi } from '../services/api/teams';
import authReducer from '../reducers/auth';
import contextReducer from '../reducers/context';
import prefsReducer from '../reducers/prefs';
import { useTheme } from './useTheme';

const makeAuthedStore = (preloaded = {}) =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      prefs: prefsReducer,
    }),
    preloadedState: {
      auth: { token: 'jwt', user: { id: 1 }, bypass: false, bootstrapped: true },
      ...preloaded,
    },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    enhancers: (gde) => gde({ autoBatch: false }),
  });

const Probe = () => {
  const { colors, scheme } = useTheme();
  return <Text testID="probe">{`${scheme}:${colors.primary}`}</Text>;
};

const ConfirmedProbe = () => {
  const { accentConfirmed } = useTheme();
  return <Text testID="confirmed">{String(accentConfirmed)}</Text>;
};

describe('useTheme (ADR-013)', () => {
  beforeEach(() => global.fetch.mockReset());

  // Regression: useTheme runs in every themed atom. A fetching subscription here + the api-level
  // refetchOnMountOrArgChange:true turned every row/atom mount into another GET /teams (infinite
  // request storm). useTheme must READ the teams cache only — never trigger a request.
  it('never fires a network request, even when authed', () => {
    const { getAllByTestId } = render(
      <Provider store={makeAuthedStore()}>
        <Probe />
        <Probe />
        <Probe />
      </Provider>,
    );
    expect(getAllByTestId('probe')).toHaveLength(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('defaults to the light default accent with an empty cache', () => {
    const { getByTestId } = render(
      <Provider store={makeAuthedStore()}>
        <Probe />
      </Provider>,
    );
    expect(getByTestId('probe').props.children).toBe('light:#2563EB');
  });

  it('forces dark when prefs.themeMode is dark', () => {
    const { getByTestId } = render(
      <Provider store={makeAuthedStore({ prefs: { themeMode: 'dark' } })}>
        <Probe />
      </Provider>,
    );
    expect(getByTestId('probe').props.children).toBe('dark:#2563EB');
  });

  // Task 10 (ADR-019): accentConfirmed lets chrome tell "genuinely personal" apart from "team selected,
  // roster not confirmed yet" — even though both currently render DEFAULT_ACCENT.
  describe('accentConfirmed', () => {
    it('is true in personal context (no roster lookup needed)', () => {
      const { getByTestId } = render(
        <Provider store={makeAuthedStore({ context: { activeTeamId: null } })}>
          <ConfirmedProbe />
        </Provider>,
      );
      expect(getByTestId('confirmed').props.children).toBe('true');
    });

    it('is false when a team is active but the roster cache is empty', () => {
      const { getByTestId } = render(
        <Provider store={makeAuthedStore({ context: { activeTeamId: 5 } })}>
          <ConfirmedProbe />
        </Provider>,
      );
      expect(getByTestId('confirmed').props.children).toBe('false');
    });

    it('is true once the active team resolves in the roster cache', async () => {
      const store = makeAuthedStore({ context: { activeTeamId: 5 } });
      await store.dispatch(
        teamsApi.util.upsertQueryData('getTeams', undefined, [{ id: 5, name: 'Acme', role: 'owner' }]),
      );
      const { getByTestId } = render(
        <Provider store={store}>
          <ConfirmedProbe />
        </Provider>,
      );
      expect(getByTestId('confirmed').props.children).toBe('true');
    });
  });
});
