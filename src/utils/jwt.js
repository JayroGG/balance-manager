import { jwtDecode } from 'jwt-decode';

// Extract the signed-in user from the backend JWT. Member-scoped writes need `myUserId` (the `sub`
// claim) to decide which rows are "mine"; login returns only { token }, so we read it from the token
// itself — no backend change (ADR-012). Returns null for a missing / placeholder / malformed token.
export const decodeUser = (token) => {
  if (!token) return null;
  try {
    const claims = jwtDecode(token);
    if (claims?.sub == null) return null;
    return { id: claims.sub, email: claims.email ?? null };
  } catch {
    return null; // bypass placeholder token or anything non-JWT
  }
};
