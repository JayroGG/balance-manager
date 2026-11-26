import { createTransform } from 'redux-persist';

// RTK Query keeps mutation results in state.api.mutations[id].data — for /auth/login that is
// {token, refreshToken}. Tokens live only in secure-store, so never let them reach AsyncStorage.
export const stripMutations = createTransform(
  (inbound) => (inbound && typeof inbound === 'object' ? { ...inbound, mutations: {} } : inbound),
  (outbound) => outbound,
  { whitelist: ['api'] },
);
