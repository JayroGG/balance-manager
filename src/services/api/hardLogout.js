import { clearAuth } from '../../reducers/auth';
import { resetContext } from '../../reducers/context';
import { resetActivity } from '../../reducers/activity';
import { clearToken } from '../storage/secure';

// The ONE teardown. Manual logout and the 401 interceptor MUST both go through here — they diverged
// once (the 401 path forgot resetContext, stranding a persisted activeTeamId) and that divergence is
// exactly what an unshared code path produces. (ADR-019)
// baseApi is required lazily (not imported at module scope) so this file can be imported from
// baseApi.js itself without a require cycle: baseApi -> hardLogout -> baseApi.
export const hardLogout = async (dispatch) => {
  dispatch(clearAuth());
  dispatch(resetContext());
  dispatch(resetActivity());
  await clearToken();
  // resetApiState() goes last so the cache wipe cannot trigger a refetch while a token is still attached.
  const { baseApi } = require('./baseApi');
  dispatch(baseApi.util.resetApiState());
};
