import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseApi } from '../services/api/baseApi';
import '../services/api'; // side-effect: register all entity endpoints (injectEndpoints)
import authReducer from '../reducers/auth';
import contextReducer from '../reducers/context';
import prefsReducer from '../reducers/prefs';
import activityReducer from '../reducers/activity';
import lockReducer from '../reducers/lock';
import { stripMutations } from './stripMutations';
import vaultOrderReducer from '../reducers/vaultOrder';
import { startVaultOrderSync } from '../reducers/vaultOrder/sync';

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  context: contextReducer,
  prefs: prefsReducer,
  activity: activityReducer,
  lock: lockReducer,
  vaultOrder: vaultOrderReducer,
});

// Persist the RTK Query cache only → instant cold-start paint + offline reads (ADR-007).
// The auth token is NOT persisted here; it lives in expo-secure-store (ADR-006).
const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: [baseApi.reducerPath, 'context', 'prefs', 'activity', 'vaultOrder'],
  transforms: [stripMutations],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);
startVaultOrderSync(store);
