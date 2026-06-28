# PRD — `balance-mobile` (React Native + Expo client)

> **Portable starter document.** Written from the `balance` backend's perspective so it can be
> dropped into a fresh repository to bootstrap the mobile app from scratch. It specifies *what the
> app must consume* (the real API), *what stack to build it on* (matching the team's existing Expo
> conventions), and *which documentation/workflow practices the new project must adopt from commit one*.
>
> Companion to the backend's `PRD.md`, `ARCHITECTURE.md`, and `.claude/ADR/`. Authored 2026-06-25.

---

## 0. Locked decisions (amended 2026-06-25)

This PRD's original stack table (§5) assumed the bare/`react-native-config` setup of
`employee-mobile-app`. During bootstrap we adopted newer patterns where they were genuinely better.
Where this section conflicts with §5, **this section and the ADRs win**:

| Topic | PRD §5/§6 said | Locked decision | ADR |
|---|---|---|---|
| Runtime | Expo SDK 53+ | **Expo SDK 56** (RN 0.85, React 19.2) — current stable at bootstrap | ADR-003 |
| Workflow | bare-style, react-native-config | **Expo managed (CNG), prebuild-on-demand**, MVP runs in Expo Go | ADR-003 |
| Env/config | react-native-config | **app.config.js + expo-constants** (`.env.dev/stage/prod`) | ADR-003 |
| Navigation | React Navigation under `stacks/` | **expo-router** (file-based `app/`) | ADR-004 |
| Data layer | slice + `createAsyncThunk` per entity | **RTK Query** (`injectEndpoints` per entity) | ADR-005 |
| Storage | AsyncStorage | **expo-secure-store (token) + AsyncStorage (cache)**; MMKV deferred | ADR-006 |
| Persistence/offline | non-goal | **redux-persist cache now** (fast cold start + offline reads); **local-first sync** is the Phase-3 north star | ADR-007 |
| App structure | screens under `screens/`, navigators under `stacks/` | **thin `app/` route shims → `src/screens/` → `src/components/ui/` (atomic, one file each)** | ADR-008 |
| Auth | wired but bypassed; Auth0 + RBAC north star | **Backend email/password JWT** (`/auth/login`,`/auth/logout`; not Auth0) — ships in Expo Go, no dev build; **bypass is dev-only** | ADR-011 |
| Team context | (none) | **Personal vs team via `?team_id=` query param** (never in body); same screens reused + a Dashboard switch; team-management CRUD deferred | ADR-011 |

Everything in §4 (the **backend contract**), §8 (screens/flows), and §9 (phases) stands unchanged.
§5 and §6 below are the **original draft**; where they differ from this table, the table + ADRs win.
The as-built structure lives in `ARCHITECTURE.md` §4.

---

## 1. Overview

`balance-mobile` is the **mobile client** for the `balance` personal-finance REST API. It lets a
single user record incomings and expenses, organize savings into **vaults**, and see their balance
broken into three figures: **total** (net worth), **available** (spendable), and **per-vault**
balances.

It is a thin, well-structured client: the backend owns all business logic and the
cents↔decimal money boundary; the app consumes decimals and renders them with a currency label
the API provides.

## 2. Goals

- Full CRUD over **transactions**, **categories**, and **vaults**, with soft-delete semantics
  (deleted resources return `404` — treat as gone).
- A **dashboard** surfacing `total`, `available`, and each vault's balance/target.
- **Allocate / withdraw** an **amount** to/from a vault, and view a vault's history.
- A **modular auth seam** (see §7): ship the prototype with auth bypassed; design so Auth0 + RBAC
  drops in later without touching screens or data layers.
- Adopt the team **documentation & workflow standard** from day one (see §10).

## 3. Non-Goals (prototype)

- No real authentication yet (single seeded user, `user_id = 1` on the backend).
- No offline-first / local persistence of records (server is source of truth; cache is optional).
- No multi-currency (one currency label, provided by `/balance`).
- No budgets, recurring transactions, charts/analytics, or push notifications.

## 4. Backend contract (what the app consumes)

**Base URL:** the API mounts routes at the root — `http://<host>:<PORT>` with no `/api` prefix.
Configure per environment via `react-native-config` (`API_URL`).

**Money:** the API speaks **decimals** (e.g. `19.99`); never send cents. Amounts are always
**positive** — the `type` field (`income` / `expense`) carries the sign meaning.

**Identity (now required — ADR-011):** every request carries `Authorization: Bearer <token>`, where the
token is the backend's own **email/password JWT** (`POST /auth/login` → `{ token }`; `POST /auth/logout`
to revoke; a `401` on any call but `/auth/login` means the session is over). The header is set in one
place (`baseApi.prepareHeaders`). A **dev-only** `AUTH_BYPASS` still sends a placeholder token. See §7 and
`docs/backend-auth-teams-contract.md`.

**Team context (ADR-011):** `transactions`, `vaults`, `categories`, `balance` are **personal** (no param)
or **team** (`?team_id=T`). `team_id` travels in the **query string only — never in a request body**; the
server injects it on writes. Response shapes are unchanged (rows gained a `team_id` field). A read-only
`GET /teams` populates the Dashboard's Personal/Team switch.

**Errors:** non-2xx responses return `{ "error": "<message>" }`. Standard codes: `400` (validation),
`404` (missing or soft-deleted), `500`. The API client must surface `error` as the user-facing message.

**Timestamps:** `created_at` / `updated_at` are ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`);
`occurred_at` is a date (`YYYY-MM-DD`). Parse/format with `luxon`.

### 4.1 Endpoints

#### Balance — `GET /balance`
Returns the computed figures. **This is the dashboard's primary call.**
```json
{
  "total": 2400.00,
  "available": 2300.00,
  "vaults": [
    { "id": 3, "name": "Emergency", "balance": 100.00, "target": 500.00 }
  ],
  "currency": "USD"
}
```
- `total` = Σincome − Σexpense (net worth). `available` = total − Σ(vault balances).
- `target` may be `null`. `currency` is the label to render all money with.

#### Transactions — `/transactions`
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/transactions` | `?type=&category_id=` (all optional filters) | `200` array |
| POST | `/transactions` | `{ type, amount, category_id?, description?, occurred_at? }` | `201` record |
| GET | `/transactions/:id` | — | `200` record / `404` |
| PUT | `/transactions/:id` | any subset of the create fields | `200` record / `404` |
| DELETE | `/transactions/:id` | — | `204` / `404` (soft delete) |

Record shape: `{ id, user_id, type, amount, category_id, description, occurred_at, created_at, updated_at, deleted_at }`.
Transactions are a **pure ledger** — money in / money out, no `vault_id`. Vault funding is an
amount-based action on the vault (see Vaults below).

**Invariants the app must respect (backend enforces with `400`):**
- `type` ∈ `income | expense`; `amount` > 0.
- **`available` can never go negative** — vaulted money is protected. A write that would push
  `available` below zero is rejected with `400`: creating an expense larger than `available`, editing
  an expense up (or an income down) past what's spendable, or deleting an income whose money is
  currently locked in a vault. Surface `error` as the user-facing message; optionally pre-validate
  client-side against `available` to fail fast (the backend is the authority).

#### Categories — `/categories`
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/categories` | — | `200` array |
| POST | `/categories` | `{ name, kind }` — `kind` ∈ `income | expense | both` | `201` |
| GET / PUT / DELETE | `/categories/:id` | `{ name?, kind? }` on PUT | `200` / `204` / `404` |

No money fields. Default seed categories exist (Salary, Freelance, Food, Transport, Health,
Utilities, Other).

#### Vaults — `/vaults` (+ actions)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/vaults` | — | `200` array |
| POST | `/vaults` | `{ name, target_amount? }` (decimal) | `201` |
| GET / PUT / DELETE | `/vaults/:id` | `{ name?, target_amount? }` on PUT | `200` / `204` / `404` |
| GET | `/vaults/:id/history` | — | `200` array of `{ id, user_id, vault_id, action, amount, created_at }`, newest first |
| POST | `/vaults/:id/allocate` | `{ amount }` (decimal) | `200` vault `{ id, name, balance, target }` — moves spendable → vault |
| POST | `/vaults/:id/withdraw` | `{ amount }` (decimal) | `200` vault `{ id, name, balance, target }` — moves vault → spendable |

**Allocate/withdraw rules (backend, surface as `400`/`404`):** allocate/withdraw move an **amount**
(not a transaction). Allocate is bounded by `available` (can't lock more than is spendable); withdraw
is bounded by the vault's `balance` (can't take out more than it holds) — either returns `400` if
exceeded. A vault's `balance` is derived from these movements. Both return `200` with the updated
vault `{ id, name, balance, target }`; the app still **refetches `GET /balance`** afterward so
`total` / `available` / vault cards stay consistent.
**Vault delete** requires a **zero balance** — withdraw to zero first, else `400`.

> Note: `GET /vaults` returns vault records only. The **balances/targets per vault** come from
> `GET /balance` (`vaults[]`). The dashboard and vault list should read balances from `/balance`.

## 5. Proposed stack

> ⚠️ **Original draft — superseded by §0 + the ADRs.** As-built: Expo SDK 56, expo-router, Redux
> Toolkit **+ RTK Query**, `app.config.js` + `expo-constants`, `expo-secure-store` + AsyncStorage,
> `redux-persist`. The table below is kept for provenance.

Match the team's existing Expo app (`employee-mobile-app`) so patterns and muscle memory carry over.
**JavaScript (no TypeScript)** to stay consistent with that app and the `balance` backend.

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Expo** (SDK 53+) + React Native 0.79+, React 19 | |
| Language | JavaScript / JSX | consistent with existing projects |
| Navigation | **React Navigation** (native-stack + bottom-tabs) | organized under `stacks/` |
| State | **Redux Toolkit** + react-redux | one slice per entity under `reducers/` |
| Networking | `fetch` + `react-native-url-polyfill`, central `errorHandler` | mirrors `services/API/*` pattern |
| Config / env | **react-native-config** (`API_URL`, `AUTH_BYPASS`) | per-environment |
| Auth | **react-native-auth0** + `jwt-decode` | wired but **bypassed** in prototype (see §7) |
| Storage | `@react-native-async-storage/async-storage` | token/credentials cache |
| i18n | `i18next` + `react-i18next` | strings under `locales/` |
| Dates/money fmt | `luxon` + a small `formatMoney(amount, currency)` helper | API already sends decimals |
| Testing | `jest` + `@testing-library/react-native` | colocated `*.test.js` |

## 6. App structure

> ⚠️ **Original draft — superseded by ADR-008 + `ARCHITECTURE.md` §4.** As-built: `app/` holds only
> expo-router route shims (`export { default } from '../../src/screens/X'`); real screens live in
> `src/screens/<Name>/`; shared UI in `src/components/ui/` (one file per component + `index.js`); the
> RTK Query data layer is in `src/services/api/`. §6.1/§6.2 below (thunk slices / `fetch` client) are
> replaced by RTK Query — see ADR-005. The tree below is kept for provenance.

Mirror the established layout:

```
balance-mobile/
├── App.jsx
├── stacks/                 # navigation: RootStack, AuthStack, AppTabs, SplashWrapper
├── screens/
│   ├── Dashboard/          # total / available / vaults summary (GET /balance)
│   ├── Transactions/       # list + filters, create/edit, detail
│   ├── Vaults/             # list, detail (history + allocate/withdraw)
│   ├── Categories/         # manage categories
│   └── Settings/
├── components/             # reusable UI (Buttons, Inputs, Card, Header, …)
├── reducers/               # Redux Toolkit slices: balance, transactions, vaults, categories, auth
├── store/                  # configureStore
├── services/
│   ├── API/                # one module per entity: balance.js, transactions.js, vaults.js, categories.js + utils (errorHandler)
│   └── AsyncStorage/       # typed wrapper around credential/token storage
├── hooks/                  # useAuth(), useIdToken(), data hooks
├── locales/                # i18next resources
├── utils/                  # formatMoney, date helpers, config
├── .claude/
│   ├── ADR/                # decision log (start with ADR-001 auth, ADR-002 doc standard — copy from balance)
│   └── agents/plans/       # /plan-feature output
├── CLAUDE.md
├── PRD.md                  # (this document, adapted)
├── ARCHITECTURE.md         # mermaid: navigation graph, state shape, data-flow
└── README.md
```

### 6.1 Redux slices (state shape)

- `balance` — `{ total, available, vaults: [{id,name,balance,target}], currency, status }` from `GET /balance`.
- `transactions` — list + filters (`type`, `category_id`) + CRUD thunks.
- `vaults` — list + selected vault history + allocate/withdraw thunks taking `(vaultId, amount)`.
- `categories` — list + CRUD thunks.
- `auth` — identity/token state (bypassed in prototype; see §7).

Each slice owns async thunks that call the matching `services/API/*` module; components never call
`fetch` directly.

### 6.2 API client pattern

One async function per endpoint, e.g.:
```js
// services/API/balance.js
import Config from 'react-native-config'
import { errorHandler } from './utils'

export const getBalance = async (token, baseUrl) => {
  const res = await fetch(`${baseUrl ?? Config.API_URL}/balance`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  return errorHandler(res)
}
```
`token` is injected centrally; in bypass mode it is a throwaway value (the backend ignores it).

## 7. Auth — the backend's JWT, bypass dev-only (ADR-011, supersedes ADR-001)

Authentication is a **single seam**, not scattered logic. **ADR-011 supersedes ADR-001:** real auth is the
backend's **email/password JWT** (not Auth0), and it ships in **Expo Go** with no dev build.

- **One injection point:** every API call gets its `Authorization: Bearer <token>` header from
  `src/services/api/baseApi.js` `prepareHeaders`, reading the `auth` slice. Screens/slices never touch the
  token directly.
- **Login / logout:** `src/screens/Login` (email + password) calls `POST /auth/login`; the JWT is stored
  in `expo-secure-store` + the `auth` slice. Settings logs out via `POST /auth/logout`, then clears the
  token, resets the team context, and purges cached data.
- **`401` = session over:** a `401` on any endpoint **except `/auth/login`** clears auth + cache and routes
  to login. `/auth/login` is exempt so a bad password is an inline error, not a logout.
- **Bypass is dev-only:** `AUTH_BYPASS` is honored **only when `ENV === 'dev'`** (hardened in
  `src/utils/config.js`); stage + prod always require real login.
- **Deferred:** full team-management CRUD and per-context RBAC (only read-only `GET /teams` is wired now).

See `.claude/ADR/ADR-011-auth-jwt-and-team-context.md` and `docs/backend-auth-teams-contract.md`.

## 8. Screens & flows (prototype scope)

1. **Dashboard** — `GET /balance`. Hero shows `total` and `available`; a list of vault cards
   (name, balance, target progress). Pull-to-refresh re-fetches.
2. **Transactions** — list with filter chips (`type`, `category`); FAB to create.
   Create/edit form: type toggle, amount, category picker, description, date (`occurred_at`).
   Swipe/menu to soft-delete. No vault field — transactions are a pure ledger.
3. **Vaults** — list (name + balance/target from `/balance`); detail shows `history` and actions to
   **allocate** or **withdraw** an **amount** (capped client-side at `available` / the vault balance).
   Delete is enabled only at a zero balance.
4. **Categories** — simple CRUD list grouped by `kind`.
5. **Settings** — currency display (from `/balance`), language (i18next), and the (disabled) auth/login entry.

## 9. Phases

- **Phase 1 — Prototype:** scaffold + doc standard; API client for all four resources; Redux slices;
  Dashboard, Transactions CRUD, Vaults (allocate/withdraw/history), Categories; auth bypassed.
- **Phase 2 — Auth + team context (ADR-011, this work):** real email/password JWT login/logout, `401`
  auto-logout, bypass made dev-only; a **team _context_** reusing the same screens (Dashboard
  Personal/Team switch threading `?team_id=`), with read-only `GET /teams`.
- **Phase 3 — Team management + RBAC (ADR-012, done):** per-context **RBAC** (owner/member/guest) gating
  every financial screen via the `src/permissions` seam (member edits own rows only; guest read-only;
  `myUserId` from the JWT `sub`), and a **Teams tab** for team CRUD (create/rename/delete) + member
  management (add by email, change role, remove) with owner-gating and the last-owner / non-empty-delete
  guardrails. **Deferred:** transfer-ownership, RBAC richer than the three roles, offline reconciliation
  of role changes.
- **Phase 4 — Enhancements (deferred):** charts/insights, budgets, recurring transactions, offline-first
  cache, push notifications, multi-currency.

## 10. Documentation & workflow standard (adopt from commit one)

This project follows the same agent-driven standard as the rest of the stack — see backend
**ADR-002**. The new repo must ship:

- **`CLAUDE.md`** — stack, commands, architecture, key files, conventions (pairs with global `~/.claude/CLAUDE.md`).
- **`PRD.md`** — this document, adapted as it evolves (requirements, locked decisions, phases).
- **`ARCHITECTURE.md`** — **Mermaid graphs** (navigation graph, Redux state shape, request/data flow)
  plus a directory/file map. Diagrams are required — they load a mental model cheaply.
- **`README.md`** — setup, env config, run/build.
- **`.claude/ADR/`** — decision log (start by copying ADR-001 auth + ADR-002 doc standard).
- **`.claude/agents/plans/`** — `/plan-feature` output; no medium/high-complexity code without a plan.
- **Per-project memory** at `~/.claude/projects/<path>/memory/` — the linked memory graph
  (`MEMORY.md` index + one fact per file).

**Workflow loop:** `/prime → /plan-feature → /execute → /commit`. Use conventional commits
(`feat:`, `fix:`, `refactor:`, `docs:`, …), one logical change each.
