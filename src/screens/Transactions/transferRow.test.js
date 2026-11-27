import { isTransferRow, transferLabel, transferSign, canRevertTransfer } from './transferRow';

const t = (key, p) => `${key}|${p.label}`;
const owned = [{ team_id: null }, { team_id: 7 }];

it('labels transfer rows by direction and reversal', () => {
  const out = { type: 'transfer_out', counterpart_label: 'Casa', reversal_of: null };
  const inn = { type: 'transfer_in', counterpart_label: 'jax (personal)', reversal_of: null };
  expect(transferLabel(out, t)).toBe('transfers.rowTo|Casa');
  expect(transferLabel(inn, t)).toBe('transfers.rowFrom|jax (personal)');
  expect(transferLabel({ ...inn, reversal_of: 3 }, t)).toBe('transfers.reversalFrom|jax (personal)');
  expect(transferLabel({ ...out, reversal_of: 3 }, t)).toBe('transfers.reversalTo|Casa');
});

it('detects transfer rows and sign', () => {
  expect(isTransferRow({ type: 'transfer_in' })).toBe(true);
  expect(isTransferRow({ type: 'income' })).toBe(false);
  expect(transferSign({ type: 'transfer_out' })).toBe(-1);
  expect(transferSign({ type: 'transfer_in' })).toBe(1);
});

it('offers revert only to a real owner of both sides, once, never on a reversal', () => {
  const tr = { user_id: 1, from_team_id: null, to_team_id: 7, reversal_of: null, reversed_by: null };
  expect(canRevertTransfer(tr, owned, 1)).toBe(true);
  expect(canRevertTransfer(tr, owned, 2)).toBe(false); // personal side isn't the viewer's
  expect(canRevertTransfer({ ...tr, to_team_id: 9 }, owned, 1)).toBe(false);
  expect(canRevertTransfer({ ...tr, reversed_by: 5 }, owned, 1)).toBe(false);
  expect(canRevertTransfer({ ...tr, reversal_of: 2 }, owned, 1)).toBe(false);
  expect(canRevertTransfer(undefined, owned, 1)).toBe(false);
});
