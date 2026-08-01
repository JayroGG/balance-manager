jest.mock('../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: false } }));

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../services/api/baseApi';
import { teamsApi } from '../services/api/teams';
import authReducer from '../reducers/auth';
import contextReducer from '../reducers/context';
import { useContextReady } from './useContextReady';

const makeStore = (activeTeamId = null) =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
    }),
    preloadedState: {
      auth: { token: 'jwt', user: { id: 1 }, bypass: false, bootstrapped: true },
      context: { activeTeamId },
    },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    enhancers: (gde) => gde({ autoBatch: false }),
  });

// Probe renders the hook's output as text so behavior is asserted via the DOM, same pattern as
// useTheme.test.js — RNTL's renderHook is intentionally avoided in favor of the existing precedent.
const Probe = ({ query }) => {
  const result = useContextReady(query);
  return <Text testID="probe">{JSON.stringify(result)}</Text>;
};

const readProbe = (getByTestId) => JSON.parse(getByTestId('probe').props.children);

describe('useContextReady (ADR-019)', () => {
  beforeEach(() => global.fetch.mockReset());

  it('personal context is always confirmed, even with an empty teams cache', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe />
      </Provider>,
    );
    expect(readProbe(getByTestId).confirmed).toBe(true);
  });

  it('team context is confirmed when the team is present in the getTeams cache', async () => {
    const store = makeStore(5);
    await store.dispatch(
      teamsApi.util.upsertQueryData('getTeams', undefined, [{ id: 5, name: 'Acme', role: 'owner' }]),
    );
    const { getByTestId } = render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );
    expect(readProbe(getByTestId).confirmed).toBe(true);
  });

  // The exact production bug (ADR-019 P2): a team is selected but the roster cache is empty.
  it('team context is NOT confirmed when the getTeams cache is empty', async () => {
    const store = makeStore(5);
    await store.dispatch(teamsApi.util.upsertQueryData('getTeams', undefined, []));
    const { getByTestId } = render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );
    expect(readProbe(getByTestId).confirmed).toBe(false);
  });

  it('team context is NOT confirmed when the cache holds other teams but not this id', async () => {
    const store = makeStore(5);
    await store.dispatch(
      teamsApi.util.upsertQueryData('getTeams', undefined, [{ id: 9, name: 'Other', role: 'owner' }]),
    );
    const { getByTestId } = render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );
    expect(readProbe(getByTestId).confirmed).toBe(false);
  });

  it('team context is NOT confirmed when the cache was never fetched', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(5)}>
        <Probe />
      </Provider>,
    );
    expect(readProbe(getByTestId).confirmed).toBe(false);
  });

  it('offline is true when the caller query errored with FETCH_ERROR', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ error: { status: 'FETCH_ERROR' } }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).offline).toBe(true);
  });

  it('offline is true when the caller query errored with TIMEOUT_ERROR', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ error: { status: 'TIMEOUT_ERROR' } }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).offline).toBe(true);
  });

  it('offline is false for a regular HTTP error', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ error: { status: 500 } }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).offline).toBe(false);
  });

  it('stale is false while a first load is in flight (no cached data yet)', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ data: undefined, isFetching: true, error: undefined }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).stale).toBe(false);
  });

  it('stale is true when cached data exists but the revalidation is offline', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe
          query={{ data: { total: 100 }, isFetching: false, error: { status: 'FETCH_ERROR' } }}
        />
      </Provider>,
    );
    expect(readProbe(getByTestId).stale).toBe(true);
  });

  it('stale is false when cached data exists and the query is fresh (no error, not fetching)', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ data: { total: 100 }, isFetching: false, error: undefined }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).stale).toBe(false);
  });

  it('lastUpdated mirrors the caller query fulfilledTimeStamp', () => {
    const { getByTestId } = render(
      <Provider store={makeStore(null)}>
        <Probe query={{ data: { total: 100 }, fulfilledTimeStamp: 12345 }} />
      </Provider>,
    );
    expect(readProbe(getByTestId).lastUpdated).toBe(12345);
  });
});
