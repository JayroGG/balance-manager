# Plan 007 — Loans (lent-out money)

> Decision record: `.claude/ADR/ADR-018-loans-lent-money.md`. Backend contract:
> `docs/backend-loans-request.md` (**intentionally untracked** — sharing doc for the BE agent,
> never committed). Origin: real use — lent money (10K/1K pending, 23K pending) can't be modeled;
> the vault workaround inverts `available` semantics.

## Model (locked)

Lent-out receivables only. Vault-mirror math: `pending = Σlend − Σrepay` per loan;
`available = total − Σvaults − Σpending`; lend bounded by `available`, repay by `pending`; no
movement changes `total`. Movements also write server-owned journal transactions (`loan_id` set,
excluded from balance + client totals). `pre_existing: true` creation posts a counted opening
income atomically. Delete needs `pending == 0`. `/balance` gains `lent` + `loans[] { id, name,
amount, pending }`.

## Tasks

1. ✅ BE request doc (`docs/backend-loans-request.md`, untracked) + ADR-018 + i18n keys (both
   locales: `tabs.loans`, `dashboard.lent`, `loans.*`, `transactions.{loans,loan,net}`,
   `activity.loan_*`).
2. Data layer: `src/services/api/loans.js` (mirror `vaults.js`: getLoans/getLoan/getLoanHistory/
   addLoan/updateLoan/deleteLoan/lendLoan/repayLoan; `withTeam` everywhere; money-movers invalidate
   `Balance` + `Transaction` list) + `Loan`/`LoanHistory` in `baseApi.js` tagTypes.
3. Screens/routes: `src/screens/Loans/{ListScreen,NewScreen,DetailScreen}.jsx` (mirror Vaults;
   figures from `/balance.loans`; progress = repaid/amount; RBAC + `useDismissOnContextChange`);
   `app/(tabs)/loans/*` shims; tab swap categories→loans (`cash-outline`); settings becomes a stack
   (`settings/{_layout,index,categories}.jsx`) hosting the Categories screen; Settings gains the row.
4. Dashboard hero "Lent out" row (`data.lent`). Transactions list: `loans` chip (client-side
   `loan_id != null`), totals exclude journal rows + third **net** cell on the left, loan badge on
   rows.
5. Activity: `loan_*` cases in `src/utils/activity.js` + `eventHref loan → /(tabs)/loans/:id`.
6. Tests: endpoints (loans), ListScreen (three totals/exclusion/chip), activity cases.
7. Docs (CLAUDE/ARCHITECTURE/PRD) + commit on `feat/loans` → PR to development.

## Verification

`npm test`; E2E vs the backend once the contract ships (pre-existing 23K → total+/avail=; wallet
loan → avail−; repay frees avail; bounds 400; delete needs zero; RBAC/context/theming/locales).

## Status

- 2026-07-15: plan approved; docs + i18n done; implementation dispatched (Sonnet agents), pending
  backend delivery for E2E.
