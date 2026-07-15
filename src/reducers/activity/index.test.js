import reducer, { markSeen, resetActivity, contextKey, selectLastSeen } from './index';

describe('activity reducer (ADR-017)', () => {
  it('starts with an empty lastSeen map', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.lastSeen).toEqual({});
  });

  it('markSeen sets a new key', () => {
    const state = reducer({ lastSeen: {} }, markSeen({ key: 'personal', id: 10 }));
    expect(state.lastSeen.personal).toBe(10);
  });

  it('markSeen advances a higher id', () => {
    const state = reducer({ lastSeen: { personal: 10 } }, markSeen({ key: 'personal', id: 20 }));
    expect(state.lastSeen.personal).toBe(20);
  });

  it('markSeen ignores a lower id', () => {
    const state = reducer({ lastSeen: { personal: 20 } }, markSeen({ key: 'personal', id: 10 }));
    expect(state.lastSeen.personal).toBe(20);
  });

  it('markSeen accepts an id: 0 seed', () => {
    const state = reducer({ lastSeen: {} }, markSeen({ key: 'personal', id: 0 }));
    expect(state.lastSeen.personal).toBe(0);
  });

  it('resetActivity clears the map', () => {
    const state = reducer({ lastSeen: { personal: 10, '7': 3 } }, resetActivity());
    expect(state.lastSeen).toEqual({});
  });
});

describe('contextKey', () => {
  it('maps null to personal', () => {
    expect(contextKey(null)).toBe('personal');
  });

  it('maps a team id to its string form', () => {
    expect(contextKey(7)).toBe('7');
  });
});

describe('selectLastSeen', () => {
  it('reads by teamId', () => {
    expect(selectLastSeen({ activity: { lastSeen: { personal: 5, '7': 12 } } }, null)).toBe(5);
    expect(selectLastSeen({ activity: { lastSeen: { personal: 5, '7': 12 } } }, 7)).toBe(12);
  });

  it('returns null when unset', () => {
    expect(selectLastSeen({ activity: { lastSeen: {} } }, null)).toBeNull();
  });
});
