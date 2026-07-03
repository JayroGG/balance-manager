# ARCHITECTURE — `balance-mobile`

Graph-first mental model for the Expo client. Pairs with `CLAUDE.md` (file map detail), `PRD.md`
(product contract), and `.claude/ADR/` (decisions). Diagrams are the cheap way to load context — keep
them in sync as the app grows (doc drift is a bug).

## 1. Navigation graph (expo-router, ADR-004)

```mermaid
graph TD
  Root["app/_layout.jsx<br/>Redux Provider + cold-start bootstrap + splash gate"]
  Index["app/index.jsx<br/>redirect by auth state"]
  Root --> Index
  Index -->|"bypass / has token"| Tabs
  Index -->|"no token (Phase 2)"| Auth

  subgraph Auth["(auth) — disabled in prototype"]
    Login["login.jsx"]
  end

  subgraph Tabs["(tabs) — bottom tab navigator"]
    subgraph Dashboard["dashboard/"]
      Dash["index.jsx<br/>GET /balance + context switch"]
      Transfer["transfer.jsx<br/>POST /transfers (ADR-014)"]
    end
    subgraph Tx["transactions/"]
      TxList["index.jsx<br/>list + filter chips + FAB"]
      TxNew["new.jsx<br/>create / edit form"]
      TxDetail["[id].jsx<br/>detail + delete"]
    end
    subgraph Vaults["vaults/"]
      VList["index.jsx<br/>list (balance/target from /balance)"]
      VDetail["[id].jsx<br/>history + allocate / withdraw"]
    end
    Cats["categories.jsx<br/>CRUD grouped by kind"]
    subgraph Teams["teams/ (ADR-012)"]
      TList["index.jsx<br/>list grouped owned / member-of + create"]
      TManage["[id].jsx<br/>owner: rename / members / roles / delete;<br/>else read-only member list"]
    end
    subgraph Sett["settings/ (ADR-014)"]
      SIndex["index.jsx<br/>currency, language, logout, Automation rows"]
      SSources["sources.jsx<br/>payment sources list"]
      SSource["source.jsx<br/>create/edit + routing + aliases"]
      SInbox["inbox.jsx<br/>review inbox (pending captures)"]
    end
  end

  Dash --> Transfer
  TxList --> TxNew
  TxList --> TxDetail
  VList --> VDetail
  TList --> TManage
  SIndex --> SSources
  SSources --> SSource
  SIndex --> SInbox
```

**Auto-capture (ADR-014).** Devices (iOS Shortcuts / MacroDroid) post payment-notification evidence
to `POST /captures` with an **ingest-scoped automation token**; the backend resolves it (hash dedup →
alias match → ±5 min cross-channel dedup → auto-post into the source's routed context). The app only
manages **payment sources** (pots of money + per-source `target_team_id` routing + recognition
aliases) and the **review inbox** (pending captures → link-to-source/confirm/discard, badge on the
Settings row). **Transfers** are one atomic two-legged operation (`expense` in *from*, `income` in
*to*, shared `transfer_group_id`); legs are immutable individually — the UI locks them and the API
400s. `team_id` travels in the *body* only in these two contracts (confirm overrides, transfer ends).

**RBAC (ADR-012).** Every financial screen gates its write affordances through one seam,
`src/permissions` (`usePermissions` → `{ canAdd, canEditRow(row), canManageTeam }`). The active role is
**derived** (never stored) by `useActiveRole` from the cached `GET /teams` (which now returns a per-team
`role`) + `activeTeamId`; `null` = personal = full access. `myUserId` (for member "own-row" checks) is
the JWT `sub` claim, decoded by `src/utils/jwt`. Guest = read-only; the backend enforces the same rules
and `403`s a violation (surfaced, not a logout).

**Theming (ADR-013).** Colors are **derived, never stored**, through one seam — `useTheme()`
(`src/hooks/useTheme.js`) → `{ colors, scheme, accent }`: the scheme comes from the persisted
`prefs.themeMode` (`system|light|dark`, System follows `useColorScheme()`), the **accent from the active
team's `color`** in the cached `GET /teams` (personal / no color → `DEFAULT_ACCENT`), and
`makeColors(scheme, accent)` (pure, `src/components/theme.js`) builds the palette with a
contrast-derived `primaryText`. Switching context re-tints the whole app (tab bar included) — that's
the context signal. There is no static `colors` export; components use
`const styles = makeStyles(colors)` factories (React Compiler memoizes).

## 2. Data flow — RTK Query (ADR-005)

Components call generated hooks only; the token is attached in exactly one place; mutations invalidate
tags so the dashboard re-fetches automatically.

```mermaid
flowchart LR
  subgraph UI["Screens (app/)"]
    H1["useGetBalanceQuery"]
    H2["useGetTransactionsQuery"]
    H3["useAddTransactionMutation"]
    H4["useAllocateVaultMutation / useWithdrawVaultMutation"]
  end

  subgraph RTKQ["src/services/api"]
    Base["baseApi.js<br/>fetchBaseQuery(baseUrl)<br/>prepareHeaders → Bearer token (AUTH SEAM)"]
    EpB["balance.js (tag: Balance)"]
    EpT["transactions.js (Transaction; inval Balance)"]
    EpV["vaults.js (Vault, VaultHistory; inval Balance)"]
    EpC["categories.js (Category)"]
    EpS["sources.js (Source — sources + aliases)"]
    EpCa["captures.js (Capture; confirm inval Transaction+Balance)"]
    EpTr["transfers.js (inval Transaction+Balance)"]
    Base --- EpB & EpT & EpV & EpC & EpS & EpCa & EpTr
  end

  Auth["reducers/auth<br/>{ token, bypass }"] -->|token| Base
  Cfg["utils/config.js<br/>(expo-constants extra)"] -->|API_URL| Base

  H1 & H2 & H3 & H4 --> Base
  Base -->|"fetch (decimals, no /api prefix)"| API[("balance backend<br/>req.userId = 1")]
  API -->|"{ error } on non-2xx → transformErrorResponse"| Base

  H3 -. "invalidatesTags ['Balance']" .-> H1
  H4 -. "invalidatesTags ['Balance','Vault','VaultHistory']" .-> H1
```

**Cache tags:** `Balance`, `Transaction`, `Vault`, `VaultHistory`, `Category`, `Team`, `TeamMember`,
`Source`, `Capture`. Per-vault balances and targets come from `GET /balance` (not `GET /vaults`), so
any mutation that moves money invalidates `Balance` — including capture confirms and transfers.

## 3. Cold-start / splash state (ADR-001, ADR-006)

```mermaid
stateDiagram-v2
  [*] --> SplashVisible: app launch (expo-splash-screen kept up)
  SplashVisible --> Bootstrapping: _layout mounts
  Bootstrapping --> Bootstrapping: redux-persist rehydrates RTKQ api cache (PersistGate, ADR-007)
  Bootstrapping --> Bootstrapping: init i18n (expo-localization + AsyncStorage lng_preference)
  Bootstrapping --> Bootstrapping: read token from expo-secure-store + AUTH_BYPASS
  Bootstrapping --> AuthHydrated: dispatch auth slice { token, bypass }
  AuthHydrated --> Ready: SplashScreen.hideAsync() (cached data paints instantly, then refetchOnReconnect)
  Ready --> Tabs: bypass || token present
  Ready --> Login: no token (Phase 2)
  Tabs --> [*]
  Login --> [*]
```

## 4. Directory / file map

```
balance-manager/                 # app name: balance-mobile
├── app.config.js                # dotenv(.env.${APP_ENV}) → extra; expo-router; React Compiler
├── eas.json                     # development(dev-client) / preview(stage) / production
├── .env.dev .env.stage .env.prod   # API_URL, AUTH_BYPASS, APP_ENV   (gitignored)
├── index.js                     # expo-router entry
├── app/                         # ROUTES ONLY (expo-router's required root folder) — thin adapters
│   ├── _layout.jsx              # providers + cold-start bootstrap + splash gate (router infra)
│   ├── index.jsx                # boot redirect (router infra)
│   ├── (auth)/      _layout.jsx  login.jsx
│   └── (tabs)/      _layout.jsx  categories.jsx
│        dashboard/{_layout,index,transfer}.jsx   settings/{_layout,index,sources,source,inbox}.jsx
│        transactions/{index,new,[id]}.jsx   vaults/{index,new,[id]}.jsx   teams/{index,[id]}.jsx
│        # each (tabs) screen file is a 1-line shim: `export { default } from '../../src/screens/X'`
├── src/                         # ALL real code lives here
│   ├── screens/                 # screen bodies (composition + data orchestration), mirrors team layout
│   │   ├── Dashboard/index.jsx
│   │   ├── Transactions/{ListScreen,NewScreen,EditScreen}.jsx  TransactionForm.jsx
│   │   ├── Vaults/{ListScreen,NewScreen,DetailScreen}.jsx
│   │   ├── Teams/{ListScreen,ManageScreen}.jsx   # team management (ADR-012)
│   │   ├── Sources/{ListScreen,EditScreen}.jsx   # payment sources + aliases (ADR-014)
│   │   ├── Inbox/index.jsx        # review inbox: pending captures (ADR-014)
│   │   ├── Transfers/NewScreen.jsx  # cross-context transfer (ADR-014)
│   │   ├── Categories/index.jsx   Settings/index.jsx
│   ├── components/
│   │   ├── ui/                  # shared atoms/molecules — one file each + index.js barrel
│   │   │   └── {Screen,ScreenHeader,Card,Button,Field,Chip,ColorSwatchPicker,MoneyText,Typography,EmptyState,QueryBoundary}.jsx
│   │   └── theme.js             # light/dark palettes + makeColors(scheme, accent) + PRESET_TEAM_COLORS; spacing/radius/font (ADR-013)
│   ├── store/                   # configureStore + RTKQ middleware + redux-persist + setupListeners
│   ├── services/
│   │   ├── api/                 # baseApi.js + balance/transactions/vaults/categories/teams/sources/captures/transfers.js (injectEndpoints)
│   │   └── storage/             # secure.js (token), prefs.js (cache/prefs)
│   ├── reducers/{auth,context,prefs}/  # auth (token/user), context (activeTeamId), prefs (themeMode — ADR-013)
│   ├── permissions/             # RBAC seam: usePermissions + pure can*() matrix (ADR-012)
│   ├── hooks/                   # useIdToken(), useActiveTeamId(), useActiveRole(), useTheme() (ADR-013)
│   ├── utils/                   # config.js, money.js, dates.js, jwt.js (decodeUser), colors.js (hex + contrast)
│   └── i18n/                    # i18next init + locales/{en-US,es-MX}.json
├── CLAUDE.md  PRD.md  ARCHITECTURE.md  README.md
└── .claude/ADR/   .claude/agents/plans/
```

> Native folders `android/` and `ios/` are intentionally **not** committed — they are regenerated by
> `npx expo prebuild` when the app moves to a dev build (ADR-003).
