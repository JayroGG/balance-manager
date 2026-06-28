// initialState.bypass reads Config.AUTH_BYPASS at module load → mock config for deterministic reducer.
jest.mock('../../utils/config', () => ({ Config: { AUTH_BYPASS: true } }));

import reducer, {
  hydrateAuth,
  setToken,
  clearAuth,
  selectToken,
  selectIsAuthed,
  selectBootstrapped,
} from './index';

const PLACEHOLDER = 'bypass-placeholder-token';

describe('auth reducer', () => {
  it('starts un-bootstrapped with no token', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(false);
  });

  it('hydrateAuth sets token + user and marks bootstrapped', () => {
    const state = reducer(undefined, hydrateAuth({ token: 't', user: { id: 1 } }));
    expect(state.token).toBe('t');
    expect(state.user).toEqual({ id: 1 });
    expect(state.bootstrapped).toBe(true);
  });

  it('hydrateAuth with empty payload nulls token/user but still bootstraps', () => {
    const state = reducer(undefined, hydrateAuth({}));
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(true);
  });

  it('setToken updates only the token', () => {
    const state = reducer({ token: null, user: { id: 1 }, bootstrapped: true }, setToken('x'));
    expect(state.token).toBe('x');
    expect(state.user).toEqual({ id: 1 });
  });

  it('clearAuth nulls token + user, leaving bootstrapped', () => {
    const state = reducer({ token: 't', user: { id: 1 }, bootstrapped: true }, clearAuth());
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(true);
  });
});

describe('auth selectors (the token seam, ADR-001)', () => {
  it('selectToken serves the placeholder in bypass mode when there is no real token', () => {
    expect(selectToken({ auth: { token: null, bypass: true } })).toBe(PLACEHOLDER);
  });

  it('selectToken prefers a real token even in bypass mode', () => {
    expect(selectToken({ auth: { token: 'real', bypass: true } })).toBe('real');
  });

  it('selectToken returns null with no token and no bypass', () => {
    expect(selectToken({ auth: { token: null, bypass: false } })).toBeNull();
  });

  it('selectIsAuthed is true under bypass or with a token, false otherwise', () => {
    expect(selectIsAuthed({ auth: { token: null, bypass: true } })).toBe(true);
    expect(selectIsAuthed({ auth: { token: 'real', bypass: false } })).toBe(true);
    expect(selectIsAuthed({ auth: { token: null, bypass: false } })).toBe(false);
  });

  it('selectBootstrapped reflects the flag', () => {
    expect(selectBootstrapped({ auth: { bootstrapped: true } })).toBe(true);
    expect(selectBootstrapped({ auth: { bootstrapped: false } })).toBe(false);
  });
});
