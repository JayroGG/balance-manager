# ADR-027 — Transfers UI, step-up prompt and admin permissions

- **Status:** Accepted (FE `balance-manager`; BE ADR-017 / ADR-018)
- **Date:** 2026-11-27

## Context
BE adds owner-only inter-context transfers guarded by a server step-up permit. The app also showed a
global admin as read-only inside teams (role 'admin' unknown to `src/permissions`).

## Decision
- **Entry:** "Transfer" button on the Dashboard, shown only when the caller owns the current context
  (personal counts) and at least one other (real role from `GET /teams`, not 'admin').
- **Flow:** destination (owned contexts except current) -> amount -> if short, manual vault split
  (source vaults with balances; confirm only when parts == shortfall exactly) -> note + date (default
  today) -> confirm summary -> step-up -> success toast; stay in source; balances, transactions, vaults
  and activity refetch for both contexts.
- **Step-up:** biometric enabled -> `expo-local-authentication` -> stored creds -> `POST /auth/step-up`;
  disabled, cancelled or failed -> email + password modal. The permit goes to that single request and is
  never stored. Same prompt before reverting a transfer.
- **Rows:** transfer rows read "Transfer from/to {counterpart_label}"; reversal rows read "Devolución
  from/to {counterpart_label}". Detail is read-only with "Revert" for an owner of both sides (once;
  not on a reversal); a reverted transfer shows "Reverted" and links to its reversal.
- **Admin:** role 'admin' gets owner affordances (`canAdd`, `canEditRow`, `canManageTeam`); transfers
  still follow real ownership.

## Consequences
- Biometric step-up reuses the stored-credential trade-off accepted in ADR-024.
- New screen + modal; no new native deps.
