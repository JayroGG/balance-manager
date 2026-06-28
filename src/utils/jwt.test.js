import { decodeUser } from './jwt';

// A real-looking JWT (HS256) whose payload is { sub: '42', email: 'a@b.co' }. Signature is irrelevant —
// the client only reads claims, it doesn't verify (ADR-012).
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiIsImVtYWlsIjoiYUBiLmNvIn0.x';

describe('decodeUser', () => {
  it('extracts id (sub) and email from a JWT', () => {
    expect(decodeUser(TOKEN)).toEqual({ id: '42', email: 'a@b.co' });
  });

  it('returns null for a missing token', () => {
    expect(decodeUser(null)).toBeNull();
    expect(decodeUser(undefined)).toBeNull();
    expect(decodeUser('')).toBeNull();
  });

  it('returns null for the dev bypass placeholder / any non-JWT string', () => {
    expect(decodeUser('bypass-placeholder-token')).toBeNull();
    expect(decodeUser('not.a.jwt')).toBeNull();
  });
});
