import { canAdd, canManageTeam, canEditRow } from './index';

// The RBAC matrix mirrors the backend (ADR-012). role === null is the personal context (full access);
// undefined means "role not resolved yet" and must read as read-only, never as personal.
describe('canAdd', () => {
  it('allows personal (null), owner, and member', () => {
    expect(canAdd(null)).toBe(true);
    expect(canAdd('owner')).toBe(true);
    expect(canAdd('member')).toBe(true);
  });
  it('denies guest and an unresolved role', () => {
    expect(canAdd('guest')).toBe(false);
    expect(canAdd(undefined)).toBe(false);
  });
});

describe('canManageTeam', () => {
  it('is owner-only', () => {
    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('member')).toBe(false);
    expect(canManageTeam('guest')).toBe(false);
    expect(canManageTeam(null)).toBe(false);
    expect(canManageTeam(undefined)).toBe(false);
  });
});

describe('canEditRow', () => {
  it('personal and owner can edit any row', () => {
    expect(canEditRow(null, { user_id: 9 }, 1)).toBe(true);
    expect(canEditRow('owner', { user_id: 9 }, 1)).toBe(true);
  });
  it('member can edit only its own rows', () => {
    expect(canEditRow('member', { user_id: 1 }, 1)).toBe(true);
    expect(canEditRow('member', { user_id: 2 }, 1)).toBe(false);
  });
  it('member matching tolerates number/string id mismatch', () => {
    expect(canEditRow('member', { user_id: '1' }, 1)).toBe(true);
  });
  it('member with a missing row or missing user_id cannot edit', () => {
    expect(canEditRow('member', null, 1)).toBe(false);
    expect(canEditRow('member', {}, 1)).toBe(false);
  });
  it('guest and unresolved roles never edit', () => {
    expect(canEditRow('guest', { user_id: 1 }, 1)).toBe(false);
    expect(canEditRow(undefined, { user_id: 1 }, 1)).toBe(false);
  });
});
