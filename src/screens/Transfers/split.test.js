import { shortfall, sumParts, splitStatus, toVaultParts } from './split';

const vaults = [
  { id: 1, balance: 500 }, // Ahorro
  { id: 2, balance: 300 }, // Viaje
];

describe('transfer split (scenario A/B)', () => {
  it('A: 1,500 from available 1,000 is short by 500', () => {
    expect(shortfall(1500, 1000)).toBe(500);
    expect(shortfall(500, 1000)).toBe(0);
  });

  it('A: Ahorro 300 + Viaje 200 is exact', () => {
    const s = splitStatus({ amount: 1500, available: 1000, vaults, parts: { 1: '300', 2: '200' } });
    expect(s).toMatchObject({ shortfall: 500, partsSum: 500, remaining: 0, blocked: false, exact: true });
    expect(toVaultParts({ 1: '300', 2: '200' })).toEqual([
      { vault_id: 1, amount: 300 },
      { vault_id: 2, amount: 200 },
    ]);
  });

  it('A: partial or over split is not exact', () => {
    expect(splitStatus({ amount: 1500, available: 1000, vaults, parts: { 1: '300' } }).exact).toBe(false);
    expect(splitStatus({ amount: 1500, available: 1000, vaults, parts: { 1: '300', 2: '300' } }).exact).toBe(false);
  });

  it('a part above its vault balance is not exact', () => {
    expect(splitStatus({ amount: 1500, available: 1000, vaults, parts: { 2: '500' } }).exact).toBe(false);
  });

  it('B: 2,000 vs 1,000 + 800 is blocked', () => {
    const s = splitStatus({ amount: 2000, available: 1000, vaults, parts: {} });
    expect(s.blocked).toBe(true);
    expect(s.exact).toBe(false);
  });

  it('1,800 exactly empties available and vaults (not blocked)', () => {
    expect(splitStatus({ amount: 1800, available: 1000, vaults, parts: { 1: 500, 2: 300 } })).toMatchObject({
      blocked: false,
      exact: true,
    });
  });

  it('no shortfall -> never exact (no vault parts allowed)', () => {
    expect(splitStatus({ amount: 500, available: 1000, vaults, parts: {} }).exact).toBe(false);
  });

  it('sums decimals without float drift', () => {
    expect(sumParts({ 1: '0.1', 2: '0.2' })).toBe(0.3);
  });
});
