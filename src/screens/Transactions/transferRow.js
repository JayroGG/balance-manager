// Transfer rows (ADR-017 / ADR-027): transfer_out / transfer_in carry transfer_id + counterpart_label;
// a row belongs to a reversal ("devolución") when its transfer has reversal_of set.
export const isTransferRow = (row) => row?.type === 'transfer_out' || row?.type === 'transfer_in';

// i18n key + params for the row title. out = "to {counterpart}", in = "from {counterpart}".
export const transferLabel = (row, t) => {
  const reversal = row.reversal_of != null;
  const dir = row.type === 'transfer_out' ? 'To' : 'From';
  return t(`transfers.${reversal ? 'reversal' : 'row'}${dir}`, { label: row.counterpart_label ?? '' });
};

export const transferSign = (row) => (row.type === 'transfer_out' ? -1 : 1);

// Revert is offered to a REAL owner of both sides, once, never on a reversal. `owned` = useOwnedContexts().
// A side is owned when its team_id (null = the actor's personal) is in `owned`; a null (personal) side is
// only the viewer's own when the viewer is the transfer's actor.
export const canRevertTransfer = (transfer, owned, myUserId) => {
  if (!transfer || transfer.reversal_of != null || transfer.reversed_by != null) return false;
  const has = (teamId) => owned.some((c) => c.team_id === teamId);
  const ownsSide = (teamId) =>
    has(teamId) && (teamId != null || String(transfer.user_id) === String(myUserId));
  return ownsSide(transfer.from_team_id) && ownsSide(transfer.to_team_id);
};
