// Pure vault-split math for a transfer (ADR-017/027). Money is decimal; compare in cents to dodge float drift.
const toCents = (n) => Math.round((Number(n) || 0) * 100);

// Amount the source's available can't cover (0 when it covers it all).
export const shortfall = (amount, available) => Math.max(0, (toCents(amount) - toCents(available)) / 100);

export const sumParts = (parts) => toCents(0) + Object.values(parts ?? {}).reduce((s, v) => s + toCents(v), 0) / 100;

// vaults: [{ id, balance }]; parts: { [vaultId]: amount }.
// blocked: available + every vault can't cover the amount. exact: parts == shortfall and each part within its vault.
export const splitStatus = ({ amount, available, vaults, parts }) => {
  const short = shortfall(amount, available);
  const vaultTotal = (vaults ?? []).reduce((s, v) => s + toCents(v.balance), 0);
  const blocked = toCents(amount) > toCents(available) + vaultTotal;
  const partsSum = sumParts(parts);
  const withinVaults = (vaults ?? []).every((v) => {
    const p = toCents(parts?.[v.id]);
    return p >= 0 && p <= toCents(v.balance);
  });
  const remaining = (toCents(short) - toCents(partsSum)) / 100;
  return {
    shortfall: short,
    blocked,
    partsSum,
    remaining,
    exact: short > 0 && !blocked && withinVaults && remaining === 0,
  };
};

// Body `vaults` array: only parts > 0.
export const toVaultParts = (parts) =>
  Object.entries(parts ?? {})
    .filter(([, v]) => toCents(v) > 0)
    .map(([id, v]) => ({ vault_id: Number(id), amount: Number(v) }));
