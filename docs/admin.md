# Admin panel

## Env vars (Vercel)
| Var | Needed for |
|---|---|
| `ADMIN_PASSWORD` | Admin login. Make it long and random. |
| `ADMIN_SECRET` | Signs admin sessions **and encrypts the 2FA secret**. Changing it logs everyone out and breaks 2FA (use the reset switch below). |
| `CRON_SECRET` | Daily 09:00 (Tunisia) check at `/api/cron/daily` (see `vercel.json`). Any long random string. Without it the job refuses to run. |
| `ADMIN_2FA_RESET=1` | **Emergency only**: bypasses 2FA if you lose your phone. Set it, redeploy, log in, turn 2FA off/on again in Settings, then **remove it** and redeploy. |

## iPhone notifications
1. On the iPhone, open `https://<your-domain>/admin` in **Safari**.
2. Share → **Add to Home Screen** (installs "Cup Admin").
3. Open Cup Admin from the home screen, sign in → **Settings & security** → **Turn on notifications** → **Send test**.

Requires iOS 16.4+. Alerts: new café to approve, new support message (max 1 per café per 2 min), daily billing check. Toggle each in Settings.

## Security
- Sessions: 7 days, HMAC cookie, revocable with "Log out all devices" (bumps `global_settings.admin_session_version`).
- 2FA: TOTP (RFC 6238), secret AES-GCM-encrypted in `global_settings.admin_totp`, codes can't be reused.
- Login: 5 failures per IP per 15 min → blocked. Every sign-in and admin action is logged (Activity log → Admin & security).
- Mutating admin requests from another origin are rejected (403).

## Archive & delete cafés
- **Archive** (café page → Edit & access → Danger zone): status → `disabled`, so baristas are blocked at once (login and existing sessions). The café is hidden from lists, totals and billing (Cafés → Archived filter shows it). Data is kept. Record in `global_settings.shop_archive:<id>` = `{ archived_at, previous_status }`.
- **Restore**: puts back `previous_status` and removes the record. Status can't be changed while archived (409).
- **Delete forever**: only for archived cafés, confirmed by typing the café code. Deletes explicitly (no reliance on cascades): push subscriptions of its orders, reviews, orders, support messages, shop history, logo files (`logos/<id>/*`), `admin_notify_throttle:support:<id>`, the shop row, then the archive record. If it stops halfway, pressing delete again finishes it. Logged as `shop_deleted` with counts.
- Code in `src/lib/shop-archive.ts`, API `POST /api/admin/shops/[id]/archive` and `DELETE /api/admin/shops/[id]`.

## Forgot PIN
- Staff login → "Forgot PIN?" → café enters its code → gets a 6-letter **reference**. Nothing is reset automatically.
- Same answer and a fresh reference for every code (real or not), writes run after the response: no way to probe which café codes exist. 5 requests / IP / hour. Archived cafés: silently ignored.
- Admin gets a push + an unread support message, and a blue banner on the café page with the reference(s). **Verify by calling the phone number on file** (never a number the caller gives), check the reference, set a new PIN ("Random" button helps), say it on the call.
- Setting a new PIN or "Dismiss" clears the request; requests expire after 7 days. Repeat asks within 30 min add a reference without re-notifying.
- Stored in `global_settings.pin_reset_request:<shopId>`. Code: `src/lib/pin-reset.ts`, `POST /api/auth/forgot`, `src/components/ForgotPin.tsx`.

## Storage (no schema changes)
Everything new lives in `global_settings`: `admin_session_version`, `admin_totp`, `admin_totp_pending`, `admin_audit`, `admin_notify_prefs`, `admin_push:<hash>` (devices), `admin_notify_throttle:<key>`, `rl:admin_login:<hash>`, `shop_archive:<shopId>`, `pin_reset_request:<shopId>`, `rl:pin_forgot:<hash>`, `shop_push:<shopId>:<hash>` (staff phones for support/broadcast notifications).
