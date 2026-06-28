import reducer, { setActiveTeam, resetContext, selectActiveTeamId } from './index';

describe('context reducer (ADR-011)', () => {
  it('starts in personal context (null team)', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.activeTeamId).toBeNull();
  });

  it('setActiveTeam sets the active team id', () => {
    const state = reducer({ activeTeamId: null }, setActiveTeam(7));
    expect(state.activeTeamId).toBe(7);
  });

  it('setActiveTeam(null) returns to personal', () => {
    const state = reducer({ activeTeamId: 7 }, setActiveTeam(null));
    expect(state.activeTeamId).toBeNull();
  });

  it('setActiveTeam with no payload normalizes to null', () => {
    const state = reducer({ activeTeamId: 7 }, setActiveTeam());
    expect(state.activeTeamId).toBeNull();
  });

  it('resetContext clears to personal', () => {
    const state = reducer({ activeTeamId: 7 }, resetContext());
    expect(state.activeTeamId).toBeNull();
  });
});

describe('context selector', () => {
  it('selectActiveTeamId reads the slice', () => {
    expect(selectActiveTeamId({ context: { activeTeamId: 3 } })).toBe(3);
    expect(selectActiveTeamId({ context: { activeTeamId: null } })).toBeNull();
  });
});
