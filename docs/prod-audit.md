# Production readiness audit

Written 2026-10-25 (after the admin rebuild, commit `5831c8f`). Tick items off as they're fixed and note the commit.
Legend: 🔴 blocker · 🟠 important · 🟡 later. **[you]** = account/dashboard action, **[code]** = code change.

## 🔴 Critical: fix before growing

### 1. Row Level Security on every table [you] (most urgent)
- Until 2026-10-25 the public anon key shipped in the browser bundle (old `lib/supabase.ts` used by `BroadcastBanner`). Old bundles still have it.
- If RLS is off, anyone with that key can read/write the DB directly: phones, PIN hashes, orders, and `global_settings` (could delete `admin_totp` to disable 2FA, or bump `admin_session_version`).
- The app only uses the service-role key (bypasses RLS), so enabling RLS with **no policies** is safe:
```sql
alter table public.shops              enable row level security;
alter table public.orders             enable row level security;
alter table public.reviews            enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.support_messages   enable row level security;
alter table public.global_settings    enable row level security;
alter table public.broadcast_history  enable row level security;
alter table public.shop_history       enable row level security;
alter table public.client_errors      enable row level security;
```
- Also check Storage → `logos` bucket policies: no anon insert/update/delete.
- Status: ☐ not confirmed

### 2. Vercel plan [you]
- Hobby is personal/non-commercial only; Cup charges 25 TND/month, so it needs **Pro**.
- Load: barista dashboard polls `/api/orders/list` every **1.2 s** → ~36k requests/day per café open 12 h ≈ 1.1M/month, already over Hobby's ~1M function invocations for one café.
- Also cut the load in code: slower polling or realtime for orders (see 12).
- Status: ☐

### 3. Backups [you]
- Supabase Free has no daily backups / PITR. Pro ($25/mo) adds daily backups (7-day retention) and no auto-pause.
- Run `supabase db dump` (command in `supabase/schema.sql` header) and commit the real schema + RPC bodies (`create_order`, `peek_order_number`, `admin_shop_stats`).
- Status: ☐

### 4. Local dev uses the production database [you]
- `.env.local` points at prod Supabase. `npm run dev` creates real shops/orders and can corrupt live data.
- Create a separate free Supabase project for dev (load it with `supabase/schema.sql` once dumped).
- Status: ☐

## 🟠 Important: next few weeks

### 5. No rate limits on public endpoints [code]
- `POST /api/shops` (signup): unlimited fake cafés; each one sends an admin push (no throttle on signup pushes).
- `POST /api/log-error`: unauthenticated inserts can fill the 500 MB DB.
- `POST /api/auth` (barista login): lockout is **per shop** (5 wrong PINs → 15 min), so anyone who knows a café code can lock that café out. No per-IP limit, so one IP can also try common PINs across all cafés.
- Fix: `createRateLimiter` (already in `lib/rate-limit.ts`) per IP on signup, log-error and auth. Make the auth lockout per IP+shop. Throttle signup pushes.
- Status: ☐

### 6. PIN reset doesn't log out barista devices [code]
- Shop cookie = `shopId.issued.hmac`, valid 30 days, with no version. Resetting the PIN or rotating it after a leak doesn't kick existing sessions (disabling the shop does block them via `requireShop`).
- Fix: per-shop session version (e.g. `global_settings` key `shop_session_version:<id>`, or a column via migration), checked in `verifyShopToken`, bumped on PIN reset and on an admin "log out café devices" button.
- Status: ☐

### 7. No server-side error monitoring [you + code]
- Only browser crashes reach `/admin/errors`. Vercel Hobby keeps logs ~1 hour.
- Add Sentry (or similar) plus an uptime check with alerts.
- Status: ☐

### 8. No CI / straight-to-prod deploys [code]
- Every push to `main` deploys to prod with no checks.
- Add a GitHub Action (lint + typecheck + build). Test on Vercel preview deploys (separate branch) before merging.
- Status: ☐

### 9. SVG logo uploads [code]
- `api/shops/[id]/logo` allows `image/svg+xml`. An SVG can contain scripts when opened directly from the storage URL.
- The client already crops to PNG, so reject SVG server-side.
- Status: ☐

### 10. No data retention [code]
- `orders`, `push_subscriptions`, `client_errors`, `shop_history` grow forever (500 MB on Free).
- Add to `/api/cron/daily`: delete done orders older than N days (keep stats), push subs for done orders, and errors older than 30 days.
- Status: ☐

### 11. Legal [you]
- Customer phone numbers are stored, with no privacy notice or terms. Tunisian data-protection law (INPDP, Loi organique 2004-63) likely applies. Check with a lawyer.
- Status: ☐

## 🟡 Later
- 12. Orders list still polls every 1.2 s: move to the same realtime ping pattern as support (big cost saving).
- 13. Content-Security-Policy header (others already set in `next.config.ts`).
- 14. Automated tests (orders lifecycle, billing, auth). Sandbox scripts from the admin rebuild (mock PostgREST + 44 auth checks) could seed this.
- 15. Online payments instead of manual billing extension.
- 16. `POST /api/push/subscribe` accepts any https endpoint (needs a valid order id): minor SSRF surface. Allowlist known push hosts.
- 17. Unused `admin.*` keys in `lib/i18n/translations.ts`. Pre-existing lint error in `lib/i18n/context.tsx`.

## Already done (2026-10-25)
- PIN hashing: scrypt + salt + pepper, live; all rows `v1w`/`v2` (`docs/pin-hash-migration.md`).
- Admin: 2FA, revocable sessions, same-origin check, audit log, rate-limited login, security headers (`docs/admin.md`).
- Removed public anon client and realtime-on-table usage. Shop routes guarded with `requireShop`.

## In progress
- Live support chat (realtime + sent/delivered/seen receipts). Needs migration `supabase/migrations/20261025_support_receipts.sql` (`delivered_at`, `read_at` on `support_messages`). Code written in the sandbox: `lib/realtime.ts`, `lib/realtime-client.ts`, `lib/support.ts`, `api/support/route.ts`. Still to do: admin API + UI, barista `SupportModal`, translations, tests.
