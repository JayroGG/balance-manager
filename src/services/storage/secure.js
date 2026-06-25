import * as SecureStore from 'expo-secure-store';

// The auth token lives ONLY here (encrypted keychain/keystore). Never in AsyncStorage. (ADR-006)
const TOKEN_KEY = 'auth_token';

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
