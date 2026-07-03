# Device automation setup — capture payments into `balance` (ADR-014)

How to wire a phone so card payments land in `POST /captures` automatically, **with retries**.
The app plays no part in capture — these automations talk straight to the API, so they work no
matter how the app was built (Expo Go, dev build, or not installed at all).

Retries are safe by design: the backend dedups on `notification_hash`, so re-sending the same
capture returns `200` with the original row — never a double transaction. Fire as many attempts
as you want.

## 0. Prereqs (once)

1. Mint an ingest token in the app: **Settings → Automation → Automation tokens → Create token**.
   Copy the secret immediately (shown once). It can only `POST /captures` — safe to store in an
   automation app.
2. Know your `API_URL` (same value as the app's env, e.g. `https://balance.example.com`).

## 1. The request both platforms send

```
POST {API_URL}/captures
Authorization: Bearer {INGEST_TOKEN}
Content-Type: application/json

{
  "channel": "google_wallet",          // or "nu_app", "apple_pay", "bbva_app", ...
  "kind": "purchase",                  // "transfer" for SPEI-style pushes; optional
  "direction": "out",                  // "in" for money received
  "amount": 129.50,                    // decimal, positive
  "merchant_raw": "OXXO",              // merchant / counterparty text as parsed
  "last4": "0347",                     // omit if the notification names no card
  "captured_at": "2026-07-03T18:03:00Z",
  "notification_hash": "google_wallet-0347-129.50-2026-07-03T18:03"
}
```

`notification_hash` doesn't need to be a real hash — **any string that's stable for the same
notification and different for different ones**. Concatenating
`channel-last4-amount-timestamp(minute precision)` is enough and both platforms can build it
with plain text actions.

Outcomes (all are success — never re-alert the user): `201` + `status:"posted"` (auto-posted),
`"duplicate"` (another app already reported it), `"pending"` (goes to the app's review inbox),
or `200` (this exact capture was already ingested — a retry landed twice, which is fine).

## 2. Android — MacroDroid (until the native listener ships)

**Trigger:** *Notification Received* → select the wallet/bank apps (Google Wallet, Nu, ...).
One macro per app keeps the parsing sane.

**Actions:**

1. *Text Manipulation* on the notification text → extract amount / merchant / last4 into local
   variables (regex per issuer format, e.g. `Pagaste \$([0-9.,]+) en (.+) con .*(\d{4})`).
2. Build `hash` = `{channel}-{last4}-{amount}-{year}{month}{day}{hour}{minute}`.
3. **Retry loop** (this is the "enable retries" part):
   - *Loop* (up to 5 iterations):
     - *HTTP Request* POST as in §1, saving the response code to a variable.
     - *If* response code is `200` or `201` → *Exit Loop*.
     - *Else Wait* before the next pass: 30 s → 2 min → 10 min → 30 min (use the loop counter).
   - *If* still failed after the loop → append the JSON body to a MacroDroid **list variable**
     `pending_captures` (the local outbox).
4. **Flush macro** (the offline net): trigger *Connectivity → Internet Available* (or a 30-min
   schedule) → for each entry in `pending_captures`: POST it; on `200`/`201` remove it from the
   list. Idempotency makes double-flushes harmless.

## 3. iOS — Shortcuts "Transaction" automation

**Automation:** Shortcuts → Automation → *Transaction* → pick your cards → **Run Immediately**.
The trigger hands you card, merchant, and amount (amount arrives as text — strip currency
symbols with *Replace Text*).

**Shortcut:** build the same JSON (hash = same concatenation recipe) → *Get Contents of URL*
(POST, headers as §1).

**Retry reality on iOS:** a failed *Get Contents of URL* **aborts the shortcut** — Shortcuts has
no try/catch, so a durable retry loop isn't really possible. Pragmatic setup:

- Wrap the POST in a *Repeat 2×* with a *Wait 20 s* between passes — this survives a transient
  blip but not a real outage (the first hard failure still aborts).
- NFC taps almost always happen with connectivity (you're at a POS), so misses are rare.
- A missed capture is not silent: iOS shows the automation-failed notification — tap it to
  re-run, or just let the expense surface as a gap you enter by hand.

The durable answer for both platforms is the **native listener + on-device outbox** (next
section) — that's where guaranteed at-least-once delivery belongs.

## 4. What changes (and doesn't) at build time

| | Today (Shortcuts / MacroDroid) | Native Android listener (future) |
|---|---|---|
| App build | **Nothing changes.** Expo Go, simulator, EAS builds — all unaffected; the app only *reads* the results. | First feature that forces `npx expo prebuild` + a dev build / EAS build (ADR-003). Expo Go stops being enough **for that build**; signing scripts already exist. |
| Permissions | Granted inside MacroDroid / Shortcuts, not the app. | User grants *Notification access* to the app in Android system settings. |
| iOS | Shortcuts automation (NFC taps only). | Unchanged — iOS forbids notification listening; Shortcuts stays the iOS path. |
| Simulator/emulator | Can't tap cards or receive bank pushes. Test by `curl`-ing `POST /captures` (acceptance curls in `docs/backend-auto-capture-request.md`) — the simulator app shows the inbox/transactions react live. | Same; emulators never see real payment notifications. |
| Retries | Inside the automation (§2/§3). | In-app outbox (`expo-sqlite` queue per ADR-007) — flush on connectivity, idempotent by hash. |
