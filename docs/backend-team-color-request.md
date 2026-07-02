# Request to `balance` backend — add `color` to teams

> **From:** `balance-mobile` (repo `/Users/jayro/Dev/ReactNative/Projects/balance-manager`)
> **To:** the `balance` backend agent (repo `/Users/jayro/Dev/Node/Projects/balance`)
> **Date:** 2026-07-02
> **Why:** the mobile app is adding app-wide theming (light/dark/system) where the **active team's
> color tints the whole UI** so a context switch is unmistakable. Personal context always uses the
> app's default accent — it needs **nothing** from the backend. The only backend need: teams gain a
> persisted `color`.
>
> Mobile-side design (for context only, no action needed): preset-swatch + custom-hex picker on team
> create/edit; accent derived client-side from `GET /teams`; dark mode is entirely client-side.
> See `/Users/jayro/Dev/ReactNative/Projects/balance-manager/.claude/agents/plans/003-team-color-and-theming.md`.

## Requested contract

### 1. Data

- `teams` gains a nullable **`color TEXT`** column — the canonical value is a 6-digit hex string
  `#RRGGBB` (store normalized **uppercase with leading `#`**, e.g. `#2563EB`).
- `NULL` = "no color set" → the client renders its default accent. Existing rows stay `NULL`; no
  backfill.
- Schema lives at `src/db/schema.sql:13-20`; since there's no migration framework, existing dev DBs
  need a one-off `ALTER TABLE teams ADD COLUMN color TEXT;` (or recreate the dev DB).

### 2. Endpoints

| Endpoint | Change |
|---|---|
| `POST /teams` | Body accepts optional `color`. Validate + normalize; invalid → `400`. |
| `PUT /teams/:id` | Currently **name-only** (custom owner-gated route, `src/entities/teams/http/controller.js` ~line 81–88 → `TeamModel.rename`, `db/model.js:30`). Extend to accept `{ name?, color? }` — **at least one required** (else `400`, as today for missing name). `color: null` explicitly **clears** the color. Owner gating unchanged. |
| `GET /teams` | Must return `color` per team. `listForMember` already does `SELECT t.*, tm.role` (`db/model.js:13`) so this should be **free** once the column exists — just confirm. |
| `GET /teams/:id` (if exposed) | Same — `SELECT *` should carry it. |

Response shape after the change: `{ id, user_id, name, color, role, created_at, updated_at, ... }`
where `color` is `"#RRGGBB"` or `null`.

### 3. Validation (in hooks / the custom controller, per house convention)

- Accept `color` matching `/^#?[0-9A-Fa-f]{6}$/` (leading `#` optional on input, case-insensitive);
  normalize to `#` + uppercase before storing. Anything else → `400 { "error": "color must be a hex color like #RRGGBB" }`.
- `color: null` on update is valid (clears). Omitted `color` = untouched.
- No role/RBAC change: same rules as `name` (any owner can set it; the create path is any user).

### 4. Explicitly out of scope (client-owned)

- The 10-color preset list, dark/light palettes, contrast logic — all client-side.
- Personal context color — there is no "personal color" concept server-side.
- No new endpoints, no changes to `transactions` / `vaults` / `categories` / `balance` / members.

## Acceptance checks (curl, with a valid `$TOKEN`)

```bash
# create with color (normalized on read)
curl -s -X POST $API/teams -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Design","color":"7c3aed"}' | jq '.color'        # → "#7C3AED"

# invalid color → 400 { error }
curl -s -X POST $API/teams -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Bad","color":"purple"}' | jq                     # → { "error": ... }

# update color only (no name) — must NOT 400 for missing name
curl -s -X PUT $API/teams/$ID -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"color":"#DC2626"}' | jq '.color'                        # → "#DC2626"

# clear it
curl -s -X PUT $API/teams/$ID -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"color":null}' | jq '.color'                             # → null

# flows through the list the mobile app consumes
curl -s $API/teams -H "Authorization: Bearer $TOKEN" | jq '.[].color'
```

## What to send back

When done, please produce a short **"work done" contract doc** (like
`docs/react-native-rbac-and-team-management-update.md` last time) covering:

1. Final request/response shapes for `POST /teams` and `PUT /teams/:id` (exact accepted body,
   normalization behavior, error messages/codes).
2. Confirmation `GET /teams` returns `color`, and whether `color: null` clear-on-update was
   implemented as specified (or how it differs).
3. Any deviation from this request (validation regex, status codes, guardrails).
4. Migration note for existing DBs (what the mobile dev must run locally).

The mobile side implements its theming plan against that doc.
