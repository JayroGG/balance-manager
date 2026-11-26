import { setToken as persistToken, setRefreshToken as persistRefreshToken } from '../storage/secure';
import { setToken, setUser } from '../../reducers/auth';
import { decodeUser } from '../../utils/jwt';

// Persist a fresh session (login or refresh): both tokens to secure-store, access token + decoded user
// to the auth slice. The one place this happens so login and the refresh path cannot drift.
export const saveSession = async ({ token, refreshToken }, dispatch) => {
  await persistToken(token);
  if (refreshToken) await persistRefreshToken(refreshToken);
  dispatch(setToken(token));
  dispatch(setUser(decodeUser(token)));
};
