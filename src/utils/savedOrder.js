// Shared by the vault (server-synced) and loan (device-only) order stores.
export const orderKey = (userId, teamId) => `${userId ?? 'anon'}:${teamId == null ? 'personal' : String(teamId)}`;

// Pure: items whose id is in `ids` come first (in `ids` order); the rest follow in list order; ids not in
// the list are dropped.
export const applySavedOrder = (list, ids) => {
  const byId = new Map(list.map((x) => [x.id, x]));
  const head = ids.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(head.map((x) => x.id));
  return [...head, ...list.filter((x) => !seen.has(x.id))];
};
