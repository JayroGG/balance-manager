jest.mock('../screens/Lock', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>LOCK SCREEN</Text> };
});
jest.mock('../i18n', () => ({}));
jest.mock('../services/storage/biometric', () => ({ isBiometricPrompting: jest.fn(() => false) }));

import { AppState, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import lockReducer from '../reducers/lock';
import prefsReducer from '../reducers/prefs';
import authReducer from '../reducers/auth';
import contextReducer from '../reducers/context';
import { combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../services/api/baseApi';
import { isBiometricPrompting } from '../services/storage/biometric';
import { LockGate } from './LockGate';

let listener;
beforeEach(() => {
  listener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => {
    listener = cb;
    return { remove: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

const renderGate = (locked) => {
  const store = configureStore({
    reducer: combineReducers({ [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, context: contextReducer, prefs: prefsReducer, lock: lockReducer }),
    preloadedState: { auth: { token: null, user: null, bypass: false, bootstrapped: true }, lock: { enabled: false, locked, passwordOnly: false, rejected: false } },
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });
  render(<Provider store={store}><LockGate><Text>SECRET BALANCE</Text></LockGate></Provider>);
  return store;
};

it('while locked the app content is not rendered at all', () => {
  renderGate(true);
  expect(screen.getByText('LOCK SCREEN')).toBeTruthy();
  expect(screen.queryByText('SECRET BALANCE')).toBeNull();
});

it('unlocked: content shows; leaving the foreground puts an opaque cover over it until active again', () => {
  renderGate(false);
  expect(screen.getByText('SECRET BALANCE')).toBeTruthy();
  expect(screen.queryByTestId('privacy-cover')).toBeNull();
  act(() => listener('inactive'));
  expect(screen.getByTestId('privacy-cover')).toBeTruthy();
  act(() => listener('active'));
  expect(screen.queryByTestId('privacy-cover')).toBeNull();
});

it('the cover also hides the lock screen (password mode shows the email) in the app switcher', () => {
  renderGate(true);
  act(() => listener('inactive'));
  expect(screen.getByTestId('privacy-cover')).toBeTruthy();
});

it('the OS Face ID sheet (inactive while a biometric prompt is open) does not flash the cover', () => {
  renderGate(true);
  isBiometricPrompting.mockReturnValue(true);
  act(() => listener('inactive'));
  expect(screen.queryByTestId('privacy-cover')).toBeNull();
  isBiometricPrompting.mockReturnValue(false);
});
