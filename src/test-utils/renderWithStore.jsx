import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../services/api/baseApi';
import authReducer from '../reducers/auth';
import contextReducer from '../reducers/context';
import prefsReducer from '../reducers/prefs';
import activityReducer from '../reducers/activity';

// Component tests need a real store now that useTheme() reads redux (prefs + auth + the getTeams
// cache). Unauthed by default → useTheme skips the /teams fetch, so nothing hits the fetch mock.
// autoBatch off for the same rAF-teardown reason as endpoints.test.js.
const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      prefs: prefsReducer,
      activity: activityReducer,
    }),
    preloadedState: { auth: { token: null, user: null, bypass: false, bootstrapped: true } },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
    enhancers: (gde) => gde({ autoBatch: false }),
  });

// Returns the RNTL render result plus the store instance — screen tests that assert on persisted
// redux state (e.g. the activity feed's mark-seen effect) read it via `store.getState()`.
export const renderWithStore = (ui, options) => {
  const store = makeStore();
  return { ...render(<Provider store={store}>{ui}</Provider>, options), store };
};

export { screen, fireEvent } from '@testing-library/react-native';
