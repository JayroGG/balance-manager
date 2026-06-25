import AsyncStorage from '@react-native-async-storage/async-storage';

// Non-secret cache/prefs. JSON-encoded. MMKV is the north-star backend swap behind this seam (ADR-006).
export const PREF_KEYS = {
  ACTIVE_ENV: 'active_env',
  LNG_PREFERENCE: 'lng_preference',
};

export const getKey = async (key) => {
  const value = await AsyncStorage.getItem(key);
  return value ? JSON.parse(value) : null;
};

export const setKey = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

export const removeKey = (key) => AsyncStorage.removeItem(key);
