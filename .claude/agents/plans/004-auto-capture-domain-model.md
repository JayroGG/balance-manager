# Feature: Auto-capture domain model — sources, aliases, captures, transfers

> **Spans two repos.** Backend work (Phases A + B) happens in
> `/Users/jayro/Dev/Node/Projects/balance`; mobile work (Phase C) in this repo
> (`/Users/jayro/Dev/ReactNative/Projects/balance-manager`). Each task is tagged
> **[BE]** or **[MOBILE]**. Run the backend phases from the backend repo (it has its own
> CLAUDE.md/conventions — same house patterns).
>
> **Source-of-truth docs (read before implementing):**
> - `docs/auto-transaction-capture-research.md` §8 (mobile repo) — the domain model + rationale
> - `docs/backend-auto-capture-request.md` (mobile repo) — the backend contract + acceptance curls
>
> The plan below is complete, but validate documentation and codebase patterns and task sanity
> before you start implementing. Pay special attention to naming of existing utils/models and
> import paths.

## PROGRESS TRACKER — update as you go (this is the cross-session resume point)

**Protocol for a fresh session:** `/prime` → read this plan top to bottom → read the two docs
above → find the first unchecked task → continue. Mark `[x]` immediately when a task's VALIDATE
passes; commit the plan file update together with the task's commit (note: `.claude/` is
gitignored in the mobile repo — use `git add -f .claude/agents/plans/004-auto-capture-domain-model.md`).

### Phase A — backend Slice 1 (sources + aliases + captures + ingest token)
- [x] A1. Schema: 3 new tables + 3 transaction columns + sessions columns (migrate.js)
- [x] A2. `payment_sources` entity (CRUD + validation hooks)
- [x] A3. `source_aliases` entity (CRUD + invariant hooks)
- [x] A4. `captures` entity skeleton (fields/model/routes, no pipeline yet)
- [x] A5. Ingest pipeline — exact dedup + alias match (controller `ingest`)
- [x] A6. Ingest pipeline — cross-channel dedup + auto-post (db.transaction)
- [x] A7. `POST /captures/:id/confirm` + `/:id/discard` review actions
- [x] A8. Automation token: `POST/GET/DELETE /auth/tokens` + ingest-scope guard
- [x] A9. Integration tests: the 6 acceptance scenarios from the contract doc
- [x] A10. Backend "work done" contract doc for the mobile side (`docs/react-native-auto-capture-update.md`; Slice 2 amendment pending B4)
### Phase B — backend Slice 2 (transfers)
- [x] B1. `transfers` routes: `POST /transfers` + `DELETE /transfers/:group_id` (atomic, RBAC both ends)
- [x] B2. Transaction hooks: block PUT/DELETE on rows with `transfer_group_id`
- [x] B3. Integration tests: transfer create/delete/guards
- [x] B4. Update backend contract doc with final transfer shapes
### Phase C — mobile (implements against A10's doc — re-verify shapes first)
- [x] C1. RTK Query endpoints: `sources.js`, `captures.js`, `transfers.js` + tags
- [x] C2. Settings stack conversion (`settings/{index,sources,source,inbox}.jsx` shims)
- [x] C3. Sources manager screen (list + create/edit + routing picker + aliases)
- [x] C4. Review inbox screen (pending captures → link/confirm/discard) + badge
- [ ] C5. Transfer action (form + `usePermissions` gating both ends)
- [ ] C6. Transaction list/detail: show source/auto-captured provenance (read-only)
- [ ] C7. Mobile tests (endpoints wiring + permission gating + screens' behavior)
- [ ] C8. Docs sync: ARCHITECTURE.md diagrams + CLAUDE.md key-files + ADR-014

---

## Feature Description

Automatic transaction capture from payment notifications (Google Wallet / Apple Pay / bank-app
pushes, delivered by iOS Shortcuts / MacroDroid now, a native Android listener later). A
notification is *evidence*, not a transaction: the same purchase can be reported twice (wallet +
bank), card-less pushes (SPEI) must resolve to an account, and each card/account routes to its own
context (personal vs team). The model: `payment_sources` (pots of money + per-source routing rule),
`source_aliases` (per-channel recognition: `card_last4` / `channel_default`), `captures` (ingest
ledger with dedup + review inbox), and first-class cross-context `transfers`.

## User Story

As the app's user paying with cards/accounts across two wallets and two banks
I want every payment notification to become the right transaction in the right context automatically
So that I stop typing expenses by hand and my personal vs company books stay correct without thinking.

## Problem Statement

Manual entry is the only way movements reach `balance` today. Notifications could automate it, but
raw notifications are ambiguous (same purchase reported by 2 apps; card-less transfer pushes) and
context-blind (an automation can't know the active team). Without an identity + routing + dedup
layer, auto-capture would double-book and dump everything into one context.

## Solution Statement

Server-side resolution pipeline on one dumb ingest endpoint: exact hash dedup → alias match →
±5 min cross-channel dedup → auto-post into the source's routed context; unresolved evidence lands
in a review inbox. Transfers become one atomic two-legged operation gated by RBAC on both ends.
Devices only parse text into structured fields; no raw notification text leaves the phone.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High (two repos, new entities, pipeline logic) — but each phase is Medium
**Primary Systems Affected**: backend `src/entities/*`, `src/db/schema.sql`, auth middleware;
mobile `src/services/api/*`, Settings stack, new screens
**Dependencies**: none new — existing stack on both sides (better-sqlite3/express; RTK Query/expo-router)

---

## CONTEXT REFERENCES

### Backend files — READ BEFORE IMPLEMENTING (repo `/Users/jayro/Dev/Node/Projects/balance`)

- `src/db/schema.sql` — table conventions (INTEGER cents, `deleted_at`, `strftime` defaults, indexes)
- `src/db/migrate.js` (lines 9–12) — the `PRAGMA table_info` + `ALTER TABLE` pattern for post-deploy columns; new tables just go in schema.sql (`CREATE TABLE IF NOT EXISTS`)
- `src/utils/modelGenerator/index.js` — generated CRUD; `fields.teamScoped` **false/absent = user-scoped** (`user_id = ?`), which is what all three new entities are; `moneyFields` converts cents↔decimal; `filterFields` whitelists `?query=` filters
- `src/utils/restGenerator/index.js` + `handlers/createHandler.js` — route mounting + hook invocation (`BEFORE_CREATE` may return an object merged into body; `assertCanWrite` runs before hooks)
- `src/constants/hooks.js` — hook type constants
- `src/entities/transactions/{db/fields.js,db/model.js,http/hooks.js,http/routes.js,index.js,constants.js}` — the canonical entity to MIRROR; `http/hooks.js` also shows `assertSpendable` + `availableCents(scope)` (the available-never-negative check) and the throw-`{message,status}` error style
- `src/entities/vaults/http/routes.js` (lines 10–16) — custom routes BEFORE restGenerator (pattern for `POST /captures` ingest override + `/:id/confirm`)
- `src/entities/vaults/http/controller.js` — custom-controller shape
- `src/entities/teams/db/members.js` — `roleOf(userId, teamId)`, `teamExists(teamId)` (needed for routing validation + auto-post membership check); import db files directly, never entity `index.js` (circular deps)
- `src/lib/access.js` — `assertCanWrite` / `assertCanMutate` RBAC gates (transfers reuse these)
- `src/middleware/auth.js` — identity boundary; where the ingest-scope claim lands (`setIdentity`); note bypass is stage-only
- `src/middleware/resolveContext.js` — how `?team_id=` becomes `req.context`; new entities do NOT mount it (user-scoped)
- `src/app.js` (lines 37–46) — the `routes[]` array; add new entities WITHOUT `context: true`
- `src/entities/auth/http/controller.js` + `src/entities/auth/db/sessions.js` — session row + `jti` JWT pattern the automation token extends
- `src/config/db.js` — better-sqlite3 handle; `db.transaction(fn)` for atomic multi-writes
- `test/helpers/api.js` + `test/integration-test/teams/teams.rbac.test.js` — supertest agent + login helper + multi-user test pattern; `npm test` runs serially against a throwaway DB

### Mobile files — READ BEFORE IMPLEMENTING (this repo)

- `src/services/api/teams.js` — injectEndpoints with tags + mutations pattern (closest analog: user-scoped, no `withTeam`)
- `src/services/api/baseApi.js` — add `'Source', 'Capture'` to `tagTypes`; the auth seam (do not touch otherwise)
- `src/services/api/transactions.js` — invalidation pattern (`Balance` on writes) — transfers must invalidate `Transaction` + `Balance`
- `src/screens/Teams/ListScreen.jsx` + `ManageScreen.jsx` — screen composition, `makeStyles(colors)` factories, `ScreenHeader` usage, form patterns
- `src/permissions/index.js` + `src/hooks/useActiveRole.js` — gating transfers on both ends
- `app/(tabs)/teams/_layout.jsx` + `app/(tabs)/teams/[id].jsx` — nested stack + 1-line shim pattern for the new settings stack
- `src/i18n/locales/{en-US,es-MX}.json` — every new string needs both locales
- `CLAUDE.md` Conventions section — theming (no static colors), team_id rules, RBAC rules

### Relevant Documentation

- `docs/auto-transaction-capture-research.md` §8 — model, pipeline order, worked scenarios, ship order
- `docs/backend-auto-capture-request.md` — exact SQL, endpoint tables, invariants, acceptance curls (the backend agent's checklist)
- Backend repo `CLAUDE.md` + `docs/` — house conventions + any prior "work done" contract docs as format reference (e.g. the team-color one)

### Patterns to Follow

**Entity layout (backend):** `src/entities/<name>/{constants.js, db/{fields.js,model.js}, http/{hooks.js,routes.js[,controller.js]}, index.js}`; `index.js` exports `{ Entity: { model, routes } }`; register in `src/entities/index.js` + `src/app.js` `routes[]`.

**Errors:** `const e = new Error('msg'); e.status = 400; throw e;` (or the `httpError` helper) — never `res.status()` inside hooks/models.

**Money:** cents in DB, decimals over the wire — declare `moneyFields: ['amount']` and never convert manually.

**Cross-entity imports:** db files directly (`require('../../transactions/db/model')`), never entity `index.js`.

**Mobile data:** components call RTK Query hooks only; mutations invalidate tags; new endpoints via `api.injectEndpoints` one file per entity.

**Mobile UI:** `useTheme()` + `makeStyles(colors)`; `ScreenHeader` on every screen; strings through i18next (both locales).

---

## IMPLEMENTATION PLAN — STEP-BY-STEP TASKS

Execute in order. Each task is atomic; validate immediately; check the tracker box; commit
(conventional commits, one logical change).

### Phase A — backend Slice 1 (repo: `/Users/jayro/Dev/Node/Projects/balance`)

#### A1. UPDATE `src/db/schema.sql` + `src/db/migrate.js`

- **IMPLEMENT**: Add `payment_sources`, `source_aliases`, `captures` tables exactly as specified in `docs/backend-auto-capture-request.md` §"Slice 1 → 1. Data" (mobile repo), following schema.sql's existing style (CHECK constraints for enums, `strftime` defaults, indexes on FK columns, `deleted_at`). Add `transactions` columns `source_id`, `capture_id`, `transfer_group_id` and `sessions` columns `name TEXT`, `scope TEXT` — new columns go in schema.sql for fresh DBs **and** as `PRAGMA table_info` guards in migrate.js (MIRROR migrate.js:9–12) for existing DBs. Unique indexes: `captures(user_id, channel, notification_hash)` partial (`WHERE notification_hash IS NOT NULL AND deleted_at IS NULL`), `source_aliases(user_id, channel, match_kind, value)` partial (`WHERE deleted_at IS NULL`).
- **GOTCHA**: SQLite `UNIQUE` constraints in-table can't be partial — use `CREATE UNIQUE INDEX ... WHERE`. `CHECK` enums: `type IN ('account','credit_card')`, `match_kind IN ('card_last4','channel_default')`, `direction IN ('in','out')`, `kind IN ('purchase','transfer','unknown')`, `status IN ('pending','posted','duplicate','discarded')`.
- **VALIDATE**: `cd /Users/jayro/Dev/Node/Projects/balance && npm run migrate && sqlite3 data/balance.db '.schema captures'`

#### A2. CREATE `src/entities/payment-sources/` (full entity)

- **IMPLEMENT**: MIRROR `src/entities/transactions/` layout. `fields.js`: `create/update: ['name','type','bank','target_team_id','default_category_id','active']`, `filterFields: ['type','bank','active']`, **no** `teamScoped`, **no** `moneyFields`. `hooks.js` BEFORE_CREATE/BEFORE_UPDATE: require `name` + valid `type` on create; when `target_team_id` set → `teamExists` + `roleOf(req.userId, target_team_id)` must be a write-capable role (`owner`/`member` — guest or non-member → 400 `"target team must be one you can write to"`). BEFORE_DESTROY: soft-delete cascades to its aliases (do it in the DESTROY hook via a direct db statement, or a custom model method). `routes.js`: plain restGenerator. Register in `src/entities/index.js` + `app.js` `routes[]` at `/payment-sources` **without** `context: true`.
- **PATTERN**: entity layout `src/entities/transactions/*`; membership check `src/middleware/resolveContext.js:19`.
- **VALIDATE**: `npm test` (existing suite green) + curl block #1 of the contract doc against a dev server.

#### A3. CREATE `src/entities/source-aliases/` (full entity)

- **IMPLEMENT**: Same layout. `fields.js`: `create/update: ['source_id','channel','match_kind','value']`, `filterFields: ['source_id','channel']`. Hooks BEFORE_CREATE/BEFORE_UPDATE: `source_id` must be the caller's own non-deleted source (query payment_sources db/model directly); `card_last4` → `value` exactly `/^\d{4}$/` (400); `channel_default` → `value` must be null/absent AND no other non-deleted `channel_default` alias may exist for `(user_id, channel)` — 400 `"channel already has a default alias"`. Mount at `/source-aliases`, no context.
- **GOTCHA**: the uniqueness index from A1 backstops races, but hooks give the friendly 400; catch `SQLITE_CONSTRAINT` in the handler path? No — house style validates in hooks and lets the index be a safety net (a raw 500 on a true race is acceptable at this scale).
- **VALIDATE**: `npm test` + create the two aliases from contract-doc curl block #1; second `channel_default` on `nu_app` → 400 (curl #7).

#### A4. CREATE `src/entities/captures/` skeleton (no pipeline yet)

- **IMPLEMENT**: `fields.js`: `create: ['channel','kind','direction','amount','merchant_raw','last4','captured_at','notification_hash']`, `update: []` (captures are never PUT), `moneyFields: ['amount']`, `filterFields: ['status','channel','source_id']`. Model: spread modelGenerator + custom finders used by A5/A6 (`findByHash(userId, channel, hash)`, `findRecentMatch(userId, sourceId, amountCents, direction, capturedAtISO, windowMinutes)`). Routes: restGenerator only for now (GET list/:id, DELETE; POST will be overridden in A5). Mount at `/captures`, no context.
- **VALIDATE**: `npm test`; `GET /captures?status=pending` returns `[]`.

#### A5. CREATE `src/entities/captures/http/controller.js` — ingest steps 1–2

- **IMPLEMENT**: Custom `ingest` handler; register `router.post('/', ctrl.ingest)` **before** `restGenerator` (MIRROR vaults/http/routes.js:10–16). Validate body: `channel` + `direction` + `amount > 0` + `captured_at` required (400). Step 1 exact dedup: `notification_hash` present and `findByHash` hits → respond **200 with the existing capture** (idempotent, no insert). Step 2 alias match: `last4` present → look up `(channel,'card_last4',last4)` alias for this user; else `(channel,'channel_default')`; found → `source_id`. No match → insert capture `status:'pending'`, respond 201.
- **GOTCHA**: `kind` defaults to `'unknown'`; ingest is also reachable by ingest-scoped tokens (A8) — keep the handler self-contained (no `req.context.teamId` reads; captures are personal-scoped to `req.userId`).
- **VALIDATE**: contract-doc curls #5 (pending) and #6 (idempotent 200) pass; `npm test`.

#### A6. UPDATE controller — ingest steps 3–4 (dedup + auto-post)

- **IMPLEMENT**: Step 3: `findRecentMatch(...)` within **±5 min** → insert as `status:'duplicate'`, `duplicate_of` set, 201, done. Step 4 auto-post, wrapped in `db.transaction(...)`: resolve the source's `target_team_id` → build scope `{ userId, teamId: target_team_id ?? null, role: roleOf(...) ?? null, isAdmin: false }`; verify write access (personal always; team → role owner/member); check `assertSpendable`-equivalent for expenses (import `availableCents` from `../../balance/db/queries`, MIRROR transactions/http/hooks.js:21–27); create the transaction via `TransactionModel.create(scope, { type: direction==='in'?'income':'expense', amount, description: merchant_raw, occurred_at: captured_at.slice(0,10), category_id: source.default_category_id })` then set `source_id`/`capture_id` on it (add these to transactions `fields.create` or set via a direct UPDATE — prefer adding to `fields.create` since ingest is server-side; they must NOT be accepted from the public POST /transactions body → strip them in transactionHooks BEFORE_CREATE when `req.ingest !== true`). Capture → `status:'posted'`, `transaction_id` set.
  **Any failure in step 4 (400 available-rule, lost membership) → catch → capture saved as `pending`** — ingest never propagates a 400.
- **GOTCHA**: `TransactionModel.create` injects `team_id` from `scope.teamId` (modelGenerator:80–81) — that's the routing mechanism, no body field. `occurred_at` is date-only.
- **VALIDATE**: contract-doc curls #2 (posted personal), #3 (duplicate), #4 (channel_default income) pass; `GET /balance` reflects #2/#4; `npm test`.

#### A7. ADD review actions `POST /captures/:id/confirm` + `/:id/discard`

- **IMPLEMENT**: In the captures controller, registered before restGenerator. `confirm`: only on own `pending` capture (404 otherwise); body `{ source_id, team_id?, category_id? }`; link source, then run steps 3–4 (extract them into a shared `resolveAndPost(capture)` helper in the controller so ingest + confirm share code); overrides: `team_id`/`category_id` beat the source's defaults. `discard`: `pending` → `discarded`, 200.
- **VALIDATE**: contract-doc curl #5 end-to-end (pending → confirm → posted); `npm test`.

#### A8. ADD automation tokens — `POST/GET/DELETE /auth/tokens` + scope guard

- **IMPLEMENT**: In the auth entity (protected routes): `POST /auth/tokens { name }` → create a session row with `name`, `scope:'ingest'`, expiry ~1 year; sign JWT `{ sub, role, jti, scope:'ingest' }` (MIRROR auth/http/controller.js:25–31 but long `expiresIn`); return `{ id, name, token }` (token shown once). `GET /auth/tokens` → own non-revoked ingest sessions (id, name, issued_at, expires_at). `DELETE /auth/tokens/:id` → `sessions.revoke` (own rows only). Guard: `middleware/auth.js` — read `scope` from the verified payload into `req.tokenScope`; add a tiny app-level middleware after `auth` in `app.js`: `if (req.tokenScope === 'ingest' && !(req.method === 'POST' && req.path === '/captures')) → 403 'ingest-scoped token'`.
- **GOTCHA**: normal login tokens have no `scope` claim — guard must only trigger on `'ingest'`. Session-expiry check in auth.js already handles revocation.
- **VALIDATE**: mint a token; `POST /captures` with it → 201; `GET /transactions` with it → 403; revoke → 401; `npm test`.

#### A9. CREATE `test/integration-test/captures/captures.pipeline.test.js`

- **IMPLEMENT**: MIRROR `test/integration-test/teams/teams.rbac.test.js` setup (helpers `login`/`api`). Cover: source+aliases setup; wallet purchase auto-posts personal expense (and balance moves); bank re-report within 5 min → duplicate; card-less `channel_default` → income; unknown last4 → pending → confirm → posted; idempotent hash re-send (200, no second transaction); second `channel_default` → 400; routed-team expense posts with correct `team_id`; available-rule failure → capture pending, not 400; ingest token can POST /captures but 403s elsewhere.
- **VALIDATE**: `cd /Users/jayro/Dev/Node/Projects/balance && npm test` — all green.

#### A10. CREATE backend `docs/auto-capture-work-done.md` (contract for mobile)

- **IMPLEMENT**: The "work done" doc per the request doc's final section: final schemas, endpoint list with exact request/response shapes, token design, deviations, dev-DB migration note. MIRROR the format of the team-color work-done doc referenced in `docs/backend-team-color-request.md` §"What to send back".
- **VALIDATE**: doc exists; every endpoint in it has a passing curl.

### Phase B — backend Slice 2: transfers (same repo)

#### B1. CREATE `src/entities/transfers/` (routes + controller, no table)

- **IMPLEMENT**: No new table — a transfer is two `transactions` rows sharing `transfer_group_id` (`crypto.randomUUID()`). `POST /transfers { amount, from_team_id?, to_team_id?, description? }`: validate `amount > 0`, from ≠ to (`null` = personal); for each team end: `teamExists` + `roleOf` write-capable else 403; expense-leg `assertSpendable` in the *from* scope; inside `db.transaction`: create expense tx in from-scope + income tx in to-scope, both with the group id + `description ?? 'Transfer'`; return `201 { transfer_group_id, from, to }`. `DELETE /transfers/:group_id`: both legs must exist, belong to caller-writable contexts → soft-delete both atomically → 204. Mount at `/transfers` (no `context: true` — contexts come from the body here, deliberately).
- **GOTCHA**: deleting the income leg could violate the *to*-context available rule (income already vaulted) — run the same `assertSpendable` check the BEFORE_DESTROY hook does for each leg before deleting; 400 with the standard message if violated.
- **VALIDATE**: curl: personal→team transfer creates both legs, balances move on both ends; guest-role target → 403; `npm test`.

#### B2. UPDATE `src/entities/transactions/http/hooks.js`

- **IMPLEMENT**: BEFORE_UPDATE / BEFORE_DESTROY: if `previous.transfer_group_id ?? record.transfer_group_id` → 400 `"part of a transfer — delete the transfer instead"`. Also strip `source_id`/`capture_id`/`transfer_group_id` from public create/update bodies (see A6 note) if not already done.
- **VALIDATE**: PUT/DELETE on a leg → 400; `DELETE /transfers/:group` still works (it bypasses the REST handler); `npm test`.

#### B3. CREATE `test/integration-test/transfers/transfers.test.js`

- **IMPLEMENT**: create/delete happy path (both balances), from=to → 400, guest end → 403, amount > available in from → 400, leg PUT/DELETE → 400, group delete restores balances.
- **VALIDATE**: `npm test`.

#### B4. UPDATE backend `docs/auto-capture-work-done.md` with transfer shapes

- **VALIDATE**: doc matches implemented behavior (re-run curls).

### Phase C — mobile (this repo; requires A10's doc — re-verify shapes against it first)

#### C1. CREATE `src/services/api/{sources,captures,transfers}.js` + UPDATE `baseApi.js`, `src/services/api/index.js`

- **IMPLEMENT**: MIRROR `src/services/api/teams.js` (user-scoped — **no** `withTeam`). `sources.js`: `getSources` (tag `Source`), add/update/delete mutations (invalidate `Source`); alias mutations (invalidate `Source`). `captures.js`: `getCaptures({ status })` (tag `Capture`), `confirmCapture`/`discardCapture` (invalidate `Capture`, `Transaction`, `Balance`). `transfers.js`: `addTransfer`, `deleteTransfer` (invalidate `Transaction`, `Balance`). Add `'Source','Capture'` to `tagTypes` in `baseApi.js`.
- **VALIDATE**: `npm test` (extend `src/services/api/endpoints.test.js` to cover the new endpoints' URL/body building).

#### C2. UPDATE Settings into a stack — `app/(tabs)/settings/{_layout,index,sources,source,inbox}.jsx`

- **IMPLEMENT**: MIRROR `app/(tabs)/teams/` (`_layout.jsx` stack with hidden native headers per the ScreenHeader convention; each file a 1-line shim). `settings/index.jsx` re-exports the existing Settings screen; add rows "Payment sources" and "Review inbox" navigating into the stack.
- **GOTCHA**: moving `app/(tabs)/settings.jsx` → `settings/index.jsx` must keep the tab name `settings`; check `(tabs)/_layout.jsx` for the tab registration.
- **VALIDATE**: `npm test`; `APP_ENV=dev npx expo start` → navigate Settings → both rows push.

#### C3. CREATE `src/screens/Sources/{ListScreen,EditScreen}.jsx`

- **IMPLEMENT**: MIRROR `src/screens/Teams/{ListScreen,ManageScreen}.jsx` composition. List: sources with name/type/bank + routed-context chip. Edit/create: name, type (account/credit_card toggle — MIRROR the transaction type toggle in `src/screens/Transactions/TransactionForm.jsx`), bank, routing picker (personal + writable teams from cached `getTeams` — filter out guest-role teams), default category, aliases section (list + add: channel picker, match_kind, last4 field; card_last4 validated `\d{4}` at the form boundary). i18n strings in both locales.
- **VALIDATE**: `npm test` (behavioral tests per project convention — render/callbacks, not design); manual: create the Nu source + 3 aliases from the worked example.

#### C4. CREATE `src/screens/Inbox/index.jsx` (review inbox)

- **IMPLEMENT**: `getCaptures({ status: 'pending' })`; rows show channel, amount (`MoneyText`), merchant_raw, captured_at; actions: link-to-source (source picker sheet → `confirmCapture`), discard. Badge: tab-bar badge or Settings-row count from the same query (lean: count on the Settings row).
- **VALIDATE**: `npm test`; manual with a seeded pending capture.

#### C5. ADD transfer action — `src/screens/Transfers/NewScreen.jsx` + route + entry point

- **IMPLEMENT**: Form: amount, from-context picker, to-context picker (each: personal + teams where `usePermissions`-style write applies — derive from cached `getTeams` roles), description. Entry: a "Transfer" action on Dashboard or Transactions header `right` slot (pick Dashboard header — it's the context hub). Client-side mirrors: from ≠ to, amount > 0; backend is authority for the rest.
- **VALIDATE**: `npm test`; manual personal→team transfer, both dashboards update (tag invalidation).

#### C6. UPDATE transaction rows/detail for provenance

- **IMPLEMENT**: If `capture_id` → small "auto" chip; if `transfer_group_id` → "transfer" chip + disable edit/delete affordances (backend 400s anyway — mirror it in UI per the boundary-mirroring convention). Uses existing `Chip` component.
- **VALIDATE**: `npm test`.

#### C7. Tests sweep

- **IMPLEMENT**: Behavioral tests for C3–C6 (test functional behavior, never design — per project memory); permission-derivation tests for the transfer context pickers.
- **VALIDATE**: `npm test` fully green; `npx expo-doctor`.

#### C8. Docs sync + ADR

- **IMPLEMENT**: ARCHITECTURE.md: add the new screens to the navigation graph + `Source`/`Capture` tags to the data-flow diagram. CLAUDE.md: key-files table rows for the new api/screens files. CREATE `.claude/ADR/ADR-014-auto-capture-domain-model.md` (Accepted; north star = aggregator feed as another channel) + index row — **force-add** (`git add -f`) since `.claude/` is gitignored. Mark §8 research doc status "decided — see ADR-014".
- **VALIDATE**: docs render; ADR indexed.

---

## TESTING STRATEGY

- **Backend**: integration tests via supertest against the throwaway test DB (`npm test`, serial).
  The pipeline test (A9) is the heart — it encodes the §8.4 worked scenarios as executable truth.
- **Mobile**: jest-expo + RNTL v13 (ADR-010). Endpoint-wiring tests extend
  `src/services/api/endpoints.test.js`; screens get behavioral tests (render, callbacks,
  gating) — never visual/design assertions (project memory: feedback-test-behavior-not-design).

### Edge cases that must have tests

- Idempotent hash re-send (no double transaction) — A9
- Duplicate window boundary (±5 min in, out) — A9
- `channel_default` conflict (second one → 400) — A9
- Auto-post failure (available rule / lost membership) → `pending`, never 400 — A9
- Ingest token scope (can POST /captures, 403 elsewhere, revocable) — A9
- Transfer legs immutability + group delete + available-rule on income-leg delete — B3
- Guest-role contexts excluded from transfer pickers — C7

## VALIDATION COMMANDS

- **Backend, every task**: `cd /Users/jayro/Dev/Node/Projects/balance && npm test`
- **Backend manual**: `NODE_ENV=stage npm start` + the acceptance-curl blocks in `docs/backend-auto-capture-request.md`
- **Mobile, every task**: `cd /Users/jayro/Dev/ReactNative/Projects/balance-manager && npm test`
- **Mobile health**: `npx expo-doctor` and `npx expo-modules-autolinking verify -v` (must stay Expo-Go safe — nothing in Phase C adds native modules)
- **Mobile manual**: `APP_ENV=dev npx expo start` against the local backend

## ACCEPTANCE CRITERIA

- [ ] All 10 acceptance-curl scenarios in `docs/backend-auto-capture-request.md` pass
- [ ] The §8.4 worked scenarios (4 notifications / SPEI in / bank transfer out) behave as documented
- [ ] Ingest never returns 4xx for a well-formed capture (fallback = `pending`)
- [ ] `npm test` green in both repos; no regressions in existing suites
- [ ] Mobile stays Expo-Go safe (no new native modules)
- [ ] Backend "work done" doc delivered (A10/B4) and mobile implemented against it
- [ ] ARCHITECTURE.md / CLAUDE.md / ADR-014 updated (C8)

## NOTES — design decisions already made (do not re-litigate; see §8 + request doc)

- Debit card = alias of its account; credit card = its own source.
- Routing is per-source (`target_team_id`), never the app's active context.
- Auto-post is the default; review inbox is the exception path.
- Resolution lives server-side; devices send structured fields only (no raw text server-side).
- Bank capture is canonical over wallet on cross-channel dedup (richer data) — implement as
  "first survives, later one folds" for MVP simplicity; canonical-preference is a refinement.
- Transfers = two linked ledger rows, not a new money concept; legs immutable individually.
- Deferred (do NOT build): retro "link as transfer" detection, aggregator channel, native
  Android listener (separate future plan; needs dev build per ADR-003).
