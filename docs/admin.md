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

## Storage (no schema changes)
Everything new lives in `global_settings`: `admin_session_version`, `admin_totp`, `admin_totp_pending`, `admin_audit`, `admin_notify_prefs`, `admin_push:<hash>` (devices), `admin_notify_throttle:<key>`, `rl:admin_login:<hash>`.
