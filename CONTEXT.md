# Cup (virtual-buzzer) — Project Context

> Reference doc for future work. Written from a full read of the codebase on 2026-10-25 (HEAD `4735f55`), updated after the known-issues cleanup (branch `chore/cleanup-known-issues`).
> If code and this doc disagree, the code wins. Update this file when you change routes, tables or flows.

---

## 1. What Cup is

Cup is a **virtual café pager** SaaS. It turns any customer phone into a "your order is ready" buzzer, with no hardware.

1. A café signs up (name, café code, 6-digit PIN). The account starts **pending** with a **15-day trial**.
2. The platform admin approves it.
3. A barista logs in and taps **New order**. The server assigns the next order number, and a QR code appears.
4. The customer scans the QR and opens `/o/<orderId>`, which is branded with the shop's logo, palette and font. The page shows a live timer and a mini-game (Catch Beans), and offers sound and push notifications.
5. The barista taps **Mark ready**. The customer's phone rings (looping MP3), vibrates, flashes the tab title, sets the app badge and gets a web-push notification.
6. The customer taps **Got it**, then leaves a 1–3 rating. The barista taps **Picked up**, which sets the order to `done`.

Market: Tunisia (prices in TND, `+216` phone placeholder). UI languages: **French (default)**, **Arabic (RTL)** and **English**.

---

## 2. Stack

| Thing | Version / notes |
|---|---|
| Next.js | **16.4.2**, App Router. ⚠️ AGENTS.md: APIs differ from older Next. Read `node_modules/next/dist/docs/` before writing code. |
| React | 19.3 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` in `globals.css`), utility classes inline, CSS vars for per-shop theme |
| DB / storage | Supabase. **All access is server-side through `supabaseAdmin`** (service-role key). There is no anon client. |
| Push | `web-push` with VAPID; service worker `public/sw.js` |
| QR | `qrcode.react` (generate, dashboard), `jsqr` (scan, `/o/latest`) |
| Icons | `lucide-react` |
| Analytics | `@vercel/analytics` |
| Hosting | Vercel (uses `after()` from `next/server` so push runs inside the invocation) |
| Fonts | Geist, Geist Mono, IBM Plex Sans Arabic (next/font); customer page loads Google Fonts dynamically per shop font |

Scripts: `npm run dev | build | start | lint`. **There is no test suite.**
Path alias: `@/*` → `src/*`.

### Environment variables (`.env.local`)
| Var | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-admin.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No longer used by any code (safe to remove) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `lib/send-push.ts`, `NotificationSetup` (subject auto-prefixed `mailto:`) |
| `PIN_PEPPER` | `lib/pin.ts`, `scripts/wrap-legacy-pins.mjs`. **Required**: login, signup and PIN reset fail without it. Must be identical across envs sharing the DB. Never lose it. |
| `ADMIN_PASSWORD` | `/api/admin/login` |
| `ADMIN_SECRET` | HMAC for admin cookie. Also the fallback for shop cookie. |
| `SHOP_SESSION_SECRET` | HMAC for shop cookie |
| `NEXT_PUBLIC_DEV_LAN_IP` (optional, dev) | Dashboard QR URL when on localhost, and `next.config.ts` `allowedDevOrigins`. Unset = QR uses the current origin. Read via `lib/config.ts`. |
| `SUPPORT_EMAIL` (optional) | Fallback email on `/expired` when no contact is set in admin (`/api/support-contact`) |
| `NEXT_PUBLIC_MONTHLY_PRICE_TND` (optional) | Admin MRR price, default 25 (`lib/config.ts`) |
| `VERCEL_OIDC_TOKEN` | Vercel-managed |

---

## 3. Actors & authentication

### Customer (no account)
- The **order UUID is the capability**. Anyone with `/o/<id>` can view it, mark it connected, subscribe to push, review it and cancel it (after 20 min).
- localStorage keys: `cup-active-order` (resume target for `/o/latest`), `cup-ack-<orderId>` (acknowledged), `cup-locale`, `catch-beans-best`, review-done keys (`ReviewPrompt`), notification-dismiss keys (`NotificationSetup`), `dismissed-broadcast` (barista).

### Barista / shop
- Login: `POST /api/auth` with `{ code, pin }`. `verifyPin` (`lib/pin.ts`) checks it against `shops.pin_hash`: HMAC with `PIN_PEPPER`, then scrypt with a per-shop salt (`v2$scrypt$…`). Legacy unsalted SHA-256 hex and `v1w` (wrapped legacy) hashes still verify and are upgraded to `v2` on successful login.
- Lockout: 5 failed attempts sets `locked_until = now + 15 min` (stored on the shop row). A success resets it.
- If the PIN is valid but the shop is pending or disabled, the server returns 403 with `status: pending|disabled` and **sets no cookie**. If it is **expired**, it returns 403 `status: expired` **and sets the cookie**, so support chat on `/expired` works (`requireShop` still blocks everything else).
- On success it sets the HttpOnly cookie **`shop_session`** = `shopId.issuedMs.hmac` (base64url HMAC-SHA256, **30 days**). See `lib/shop-auth.ts`.
- Guards (`lib/shop-auth.ts`):
  - `requireShopAuth(id?)`: identity only (valid cookie, matching shop id). **Use it only for support chat**, so expired shops can still reach the admin.
  - `requireShop(id?)`: identity **plus** entitlement: `status === 'active'` and (`trial_ends_at > now` or `subscription_ends_at > now`). Returns 401 `Unauthorized`, 403 `Forbidden`, 403 `Account inactive` or 403 `Subscription expired`.
- The client also caches `shop_id`, `shop_name`, `shop_code` and `shop_expired_reason` in localStorage. This cache only drives the UI. On any guarded call, **401 redirects to `/barista`** (and clears the cache) and **403 redirects to `/expired`**.
- `GET /api/auth/session` restores identity from the cookie (used by `/` and `/barista` to auto-redirect to the dashboard).

### Platform admin
- Single shared password `ADMIN_PASSWORD`. `POST /api/admin/login` compares it in constant time.
- Rate limit: 5 failed attempts per 15 min per IP, persisted in `global_settings` (`rl:admin_login:<sha256(ip)>`) via `lib/rate-limit.ts`, so it's shared across instances. Falls back to per-instance memory if the DB is unreachable.
- Cookie **`admin_session`** = `issuedMs.hmacHex` (HMAC-SHA256 with `ADMIN_SECRET`), **7 days**. Checked by `isAdminAuthed()` in `lib/admin-auth.ts`.
- Admin pages are client components. They call admin APIs and redirect to `/admin/login` on a 401. There is no middleware.

---

## 4. Data model (Supabase)

A **reconstructed** schema is in `supabase/schema.sql` (rebuilt from queries, not a verified dump; it has the `supabase db dump` command to replace it). RPC bodies still live only in Supabase.

### Tables
**`shops`**
| column | notes |
|---|---|
| `id` uuid PK | Treated as secret-ish: never returned by the public order endpoint |
| `name`, `tagline` | |
| `code` | unique login slug (slugified; random suffix if taken; `shop-xxxxx` if < 3 chars) |
| `pin_hash` | `v2$scrypt$N=…,r=…,p=…$salt$hash` (or legacy hex / `v1w`, see `lib/pin.ts`) |
| `status` | `pending` \| `active` \| `disabled` (raw; "expired" is **derived**, never stored) |
| `phone` | used by admin billing WhatsApp link |
| `logo_url`, `logo_scale`, `logo_offset_x`, `logo_offset_y` | logo in the Supabase storage bucket `logos` |
| `theme` jsonb | `{ palette: PaletteId, font: FontId, primary?: hex }` |
| `game` | `'catch-beans'` (default) \| `'none'` |
| `messages` jsonb | `{ preparing?: string, ready?: string }` custom customer texts |
| `trial_ends_at` | set to now + 15 days at signup |
| `subscription_ends_at` | extended by admin billing |
| `billing_status` | `'trial'` at signup, `'active'` after extension |
| `paid_current_month` | bool, set true on extension |
| `login_attempts`, `locked_until` | PIN lockout |
| `has_created_order` | onboarding flag (set inside the `create_order` RPC) |
| `created_at` | |

**`orders`**: `id` uuid, `shop_id` FK, `order_number` text (1–4 digits), `status` `preparing|ready|done`, `customer_connected` bool, `customer_phone` (nullable, normalized `+?\d{6,20}`), `created_at`, `ready_at`. There is a unique constraint on the active order number per shop (a violation returns Postgres `23505`, which the API maps to `DUPLICATE_ORDER_NUMBER`). Setting an order to `done` frees its number.

**`reviews`**: `order_id` (unique, upsert target), `shop_id`, `rating` 1–3, `comment` (≤200 chars, nullable), `created_at`.

**`push_subscriptions`**: `order_id`, `endpoint` (unique, upsert target), `subscription` jsonb. Rows are deleted on push 404/410.

**`support_messages`**: `id`, `shop_id`, `message`, `sender` `barista|admin`, `is_read`, `created_at`.

**`global_settings`**: `key` (unique) → `value` jsonb. Keys: `broadcast` = `{active, message}`, `support_contact` = `{email, phone}`, `rl:<scope>:<hash>` = `{count, reset_at}` (rate limits).

**`broadcast_history`**: `id`, `message`, `active`, `created_at`.

**`shop_history`**: `id`, `shop_id`, `action` (`created`, `renamed`, `approved`, `disabled`, `pin_reset`, `billing_extended`), `details` jsonb, `created_at`.

**`client_errors`**: `message`, `stack`, `url`, `user_agent`.

### RPC functions (Postgres)
- `create_order(p_shop_id, p_number, p_phone)` claims the next number when `p_number` is empty, inserts the order, sets `has_created_order`, and returns the order row (object, or array tolerated).
- `peek_order_number(p_shop_id)` returns the next number without claiming it.
- `admin_shop_stats()` returns per-shop rows `{shop_id, orders_total, orders_7d, orders_30d, orders_today, last_order_at, rating_avg, rating_count}`.

### Derived shop state (computed in `/api/admin/shops*`, `/api/auth`, `requireShop`)
```
pending   if status = 'pending'
disabled  if status = 'disabled'
expired   if neither trial_ends_at nor subscription_ends_at is in the future
active    otherwise
days_left = ceil((max(trial_end, sub_end) - now) / 1 day), min 0
is_trial  = trial valid AND subscription not valid
```

---

## 5. Pages (App Router, all client components unless noted)

| Route | File | What it does | APIs | Polling |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Marketing landing: tagline, buttons "Set up shop" (free trial) and "Barista login", 3-step how-it-works. Redirects to the dashboard if a session cookie exists. | `GET /api/auth/session` | – |
| `/setup` | `app/setup/page.tsx` | Sign-up form: name, café code (auto-slug from name), 6-digit PIN. Saves `shop_id/name/code` to localStorage and goes to `/pending`. | `POST /api/shops` | – |
| `/pending` | `app/pending/page.tsx` | "Awaiting approval" screen. On approval it clears the cached `shop_id` and sends the barista to `/barista` to log in (no cookie exists yet). Can also show declined. | `GET /api/shops/[id]/status` | 5 s |
| `/barista` | `app/barista/page.tsx` | Code + PIN login. Fast path: localStorage `shop_id` goes straight to the dashboard. Slow path: restore from the cookie. Handles pending, disabled and expired responses. | `GET /api/auth/session`, `POST /api/auth` | – |
| `/barista/dashboard` | `app/barista/dashboard/page.tsx` | Main barista screen (details below). | many | orders 1.2 s, support 30 s |
| `/barista/customize` | `app/barista/customize/page.tsx` | Branding and theme editor (details below). `?tab=branding|theme|game|messages`. Wrapped in `Suspense` (uses `useSearchParams`). | `GET/PATCH /api/shops/[id]`, `POST /api/shops/[id]/logo` | – |
| `/expired` | `app/expired/page.tsx` | Trial or subscription wall (`shop_expired_reason`). Support chat button with unread badge, admin contact (email/phone), logout. | `GET /api/support-contact`, `GET /api/support`, `POST /api/auth/logout` | unread 15 s |
| `/o/[id]` | `app/o/[id]/page.tsx` (server, `force-dynamic`) → `client.tsx` | Customer order page (details below). The server renders the order and shop via `lib/public-order.ts`. `layout.tsx` sets a per-order manifest `/o/<id>/manifest.webmanifest` so "Add to home screen" opens this order. | polling `GET /api/o/[id]`, `POST /api/orders/[id]/connect`, `/cancel`, `/api/push/subscribe`, `/api/reviews` | 4 s (visible only) |
| `/o/latest` | `app/o/latest/page.tsx` | PWA start point: if `cup-active-order` exists and isn't done, redirect to it. Otherwise show "no order" and a **QR scanner** (camera + jsQR, extracts the UUID from a `/o/<uuid>` URL or a bare UUID). | `GET /api/orders/[id]/status` | – |
| `/admin/login` | `app/admin/login/page.tsx` | Password form | `POST /api/admin/login` | – |
| `/admin` | `app/admin/page.tsx` | Admin home: nav (Live, Billing, Support, Reviews, Broadcast), "attention" strip (pending, expired, expiring ≤7 d), KPI cards (orders today, total orders, shops, avg rating), search plus status filter (all/pending/active/expired/disabled), shop list with derived badges, days-left chip, last order, 30 d and total counts. | `GET /api/admin/shops`, `GET /api/admin/support` | support unread 30 s |
| `/admin/shops/[id]` | `app/admin/shops/[id]/page.tsx` | Shop detail: identity (logo, state, code, member since), KPIs. **Overview tab**: approve/decline (pending), enable/disable (with ConfirmDialog), reset PIN (6 digits), billing dates, extend +1/3/6/12 months. **Orders tab**: last 50, filterable. **Feedback tab**: reviews and the `shop_history` activity log. Danger zone: delete shop. | `GET/PATCH/DELETE /api/admin/shops/[id]`, `POST /api/admin/shops/[id]/billing` | – |
| `/admin/billing` | `app/admin/billing/page.tsx` | Billing overview: filters all/trial/active/expired/unpaid, counts, **MRR = active × 25 TND** (hard-coded `MONTHLY_PRICE`), WhatsApp reminder link `wa.me/<phone>?text=billing.whatsappMsg`. | `GET /api/admin/shops` | – |
| `/admin/live` | `app/admin/live/page.tsx` | Live cross-shop feed of the last 50 orders, filter by shop, search by shop name or order number, "Xs ago". | `GET /api/admin/live` | 4 s (visible) |
| `/admin/reviews` | `app/admin/reviews/page.tsx` | Last 100 reviews across shops, rating filter (1/2/3), search | `GET /api/admin/reviews` | – |
| `/admin/support` | `app/admin/support/page.tsx` | Support inbox grouped by shop, opening a thread marks it read, reply as admin | `GET/POST/PATCH /api/admin/support` | – |
| `/admin/broadcast` | `app/admin/broadcast/page.tsx` | Toggle and edit the global banner shown on barista dashboards, view broadcast history, and edit the support contact (email/phone shown on `/expired`). | `GET/PATCH /api/broadcast`, `GET/PATCH /api/admin/contact` | – |
| (error) | `app/error.tsx` | Error boundary. POSTs `{message, stack, url}` to `/api/log-error` and shows a retry button. | | |
| (404) | `app/not-found.tsx` | Translated "not found" | | |
| manifest | `app/manifest.ts` | Global PWA manifest "Cup", start `/` | | |

### Barista dashboard details (`barista/dashboard/page.tsx`)
- Loads shop info (`GET /api/shops/[id]`) for the name, tagline and logo in the header.
- Header: language switcher, support (LifeBuoy, red dot when there are unread admin messages), a Customize dropdown (4 links into the customize tabs), logout.
- `BroadcastBanner` at the top (polls `/api/broadcast`; dismissal is stored per message text).
- `OnboardingChecklist`: steps "upload logo" and "create first order" (`GET /api/shops/[id]/onboarding`), dismissible.
- **New order** button shows `#next` from `GET /api/orders/next`, refetched after each create.
  - Modal: order number (prefilled with next; only sent if the barista edited it; 1–4 digits) and optional customer phone.
  - `POST /api/orders` adds the order to the list optimistically and opens the **QR modal**.
- Order cards (status ≠ done): number, preparing/ready badge, live timer (`useElapsed`, stops at `ready_at`), "customer connected / not scanned" dot, phone with **Call** (`tel:`) and **SMS** (`sms:?body=dash.smsBody`), QR button, and **Mark ready**, or **Picked up** (→ done) once ready.
  - Status changes are optimistic with rollback on error and a per-order busy guard.
- Polling: `GET /api/orders/list` every **1.2 s** while visible, plus on focus/visibility, with an in-flight guard.
- QR URL: on localhost it uses `http://<DEV_LAN_IP>:<port>/o/<id>` so a phone on the LAN can open it.
- Uses its own local `Modal` and a red toast (not `components/ui/*`).

### Customize page details (`barista/customize/page.tsx`)
- Left panel with tabs:
  - **Branding**: name ≤40, tagline ≤60, logo upload (`LogoUploader`: client-side square crop to PNG, max 2 MB, PNG/JPG/WEBP/SVG) and `LogoAdjuster` (scale/offset), remove logo.
  - **Theme**: 7 palettes, custom primary color (picker and hex), 3 fonts, reset.
  - **Game**: catch-beans or none.
  - **Messages**: custom preparing/ready texts ≤40, with a preview.
- **Autosave**: fields are diffed against the last saved `shop` and `PATCH`ed after a 900 ms debounce. The header shows "Saving…" or "Saved".
- Right panel: `CustomerPreview` mock with a phone/desktop toggle and a preparing/ready toggle. It renders the palette, font, logo, messages, game stub and bean pattern.

### Customer order page details (`o/[id]/client.tsx`)
- `page.tsx` loads the order and shop on the server (`getPublicOrder`) and passes `initialOrder`/`initialShop`, so the first paint already shows the branded page. Not found passes `null`, which shows the error. On a DB error it passes nothing, and the client falls back to fetching `GET /api/o/[id]`.
- On load it saves `cup-active-order`, fires `POST /api/orders/[id]/connect`, and starts ringing if the order is already ready and not acknowledged. If it is already acknowledged or done, it redirects to `/o/latest`.
- **Audio engine**: uses a Web Audio `AudioContext` and the decoded `/ready.mp3` buffer, played in a loop (falls back to an `<audio>` element). It unlocks on the first pointerdown or keydown, or with the "Enable sound" button. The context resumes when the page becomes visible again.
- **When ready**: looping sound, vibration `[500,200,500,200,500]` every 2 s, title flashing every 800 ms, `setBadge(1)` (App Badging API). There is a big **Got it** button. Acknowledging stores `cup-ack-<id>`, clears the active order, shows "Enjoy" plus `ReviewPrompt`, and after 7 s goes to `/o/latest`.
- **Preparing**: custom or default message, 3-step progress bar, live "waiting for" timer, and a stale-order panel (meant for >30 min) offering cancel (`POST /api/orders/[id]/cancel`) or keep waiting.
- Screen wake lock, per-shop theme via CSS vars (`paletteVars`), optional custom primary color, Google Font injection, `CozyPattern` background for the `cozy` palette.
- `NotificationSetup` (registers `/sw.js`, asks permission, subscribes with VAPID, `POST /api/push/subscribe`; silently resubscribes if permission was already granted; dismissible).
- `CatchBeans` game (lazy, `ssr:false`, requestAnimationFrame, 3 lives, best score in localStorage), hidden if `shop.game === 'none'`.

---

## 6. API reference

Auth legend: **public** = none · **shop-id** = `requireShopAuth` (identity) · **shop** = `requireShop` (identity + entitlement) · **admin** = `isAdminAuthed`.
Every handler uses `supabaseAdmin`. Errors return `{ error }` JSON. `ctx.params` is awaited (typed `Promise<{id}> | {id}`).

### Auth
| Method | Path | Auth | Body / query | Response / effects |
|---|---|---|---|---|
| POST | `/api/auth` | public | `{code, pin}` | 200 `{shop:{id,name,code}}` and sets `shop_session`. 401 bad creds. 429 locked. 403 `{status:'pending', shop_id, shop_name}` / `{status:'disabled'}` / `{status:'expired', reason:'trial'|'subscription', shop_id, shop_name}` (expired also sets the cookie). Updates lockout counters. |
| GET | `/api/auth/session` | cookie | – | `{shop:{id,name,status}, active, trial_ok, subscription_ok}`, or 401 `{shop:null}` |
| POST | `/api/auth/logout` | – | – | clears `shop_session` |

### Shops (barista side)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/shops` | public | Sign-up `{name, code?, pin}` (PIN length 6). Creates `status:'pending'`, `billing_status:'trial'`, `trial_ends_at:+15d`, logs `shop_history.created`. Returns `{shop:{id,name,code,status}}`. |
| GET | `/api/shops/[id]` | **shop** | `{shop:{id,name,tagline,status,logo_*,theme,game,messages,has_created_order}}` |
| PATCH | `/api/shops/[id]` | **shop** | Whitelist: name, tagline, logo_url, logo_scale, logo_offset_x/y, theme, game, messages, has_created_order |
| POST | `/api/shops/[id]/logo` | **shop** | multipart `file` (PNG/JPEG/WEBP/SVG ≤2 MB). Uploads to bucket `logos/<id>/<ts>.<ext>` and sets `logo_url`. Returns `{logo_url}`. |
| GET | `/api/shops/[id]/onboarding` | **shop** | `{shop:{logo_url, theme, has_created_order}}` |
| GET | `/api/shops/[id]/status` | public | `{status}` only (raw pending/active/disabled). Used by `/pending`, because pending shops have no cookie. 404 if the shop was deleted. |

### Orders
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/orders` | **shop** | `{shop_id, order_number?, customer_phone?}`. The number must be 1–4 digits if given, and the phone is normalized. Calls the RPC `create_order`. 409 `{code:'DUPLICATE_ORDER_NUMBER'}`, 404 if the shop FK is missing. Returns `{order}`. |
| GET | `/api/orders/list?shop_id=` | **shop** | Up to 50 non-done orders, newest first (`select *`, includes `customer_phone`) |
| GET | `/api/orders/next?shop_id=` | **shop** | `{next}` via `peek_order_number` |
| PATCH | `/api/orders/[id]` | **shop** (must own the order) | `{status: preparing|ready|done}`. `ready` sets `ready_at` and schedules `sendOrderReadyPush` in `after()`. Returns `{order}`. |
| GET | `/api/orders/[id]/status` | public | `{order:{id,order_number,status,created_at}}` |
| POST | `/api/orders/[id]/connect` | public | sets `customer_connected=true` |
| POST | `/api/orders/[id]/cancel` | public | Only if `preparing` and age > 20 min. Sets `status='done'`. 409 otherwise. |

### Customer / public
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/o/[id]` | public | `{order:{id,order_number,status,created_at,ready_at,customer_connected}, shop:{name,tagline,logo_*,theme,game,messages}}`. Single joined query in `lib/public-order.ts` (shared with the server render). **Never returns shop id.** Malformed UUID → 404. `no-store`. |
| GET | `/o/[id]/manifest.webmanifest` | public | Per-order PWA manifest "Cup - Ma commande", `start_url /o/<id>`, scope `/o/` |
| POST | `/api/push/subscribe` | public | `{order_id, subscription}`, upsert by `endpoint` |
| POST | `/api/reviews` | public | `{order_id, rating:1|2|3, comment?}`. The order must be ready or done. Upsert by `order_id`. |
| GET | `/api/broadcast` | public | `{broadcast:{active,message}, history:[last 10]}` |
| GET | `/api/support-contact` | public | `{email, phone}` from `global_settings.support_contact` (fallback email hard-coded) |
| POST | `/api/log-error` | public | `{message, stack, url}`, clipped and inserted into `client_errors`. Never fails loudly. |

### Support chat (barista)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/support?shop_id=` | shop-id | last 20 messages for the shop (newest first) plus `unread` (admin → barista, unread) |
| POST | `/api/support` | shop-id | `{shop_id, message}` inserted with `sender:'barista'` |
| PATCH | `/api/support` | shop-id | `{shop_id}` marks admin messages read |

Component `SupportModal` polls GET every 5 s while open and PATCHes (mark read) on open.

### Admin
| Method | Path | Notes |
|---|---|---|
| POST | `/api/admin/login` | `{password}` sets `admin_session`. 401 wrong password, 429 rate-limited, 500 if `ADMIN_PASSWORD` is missing. |
| POST | `/api/admin/logout` | clears the cookie |
| GET | `/api/admin/shops` | All shops plus `admin_shop_stats()` merged. Each shop gets derived `status` (raw in `raw_status`), `is_trial`, `days_left`, `stats{total,last7,last30,today,last_order_at,rating,rating_count}`. Also returns `globalStats{totalOrders, ordersToday, totalShops, activeShops, expiringSoon, totalReviews, avgRating}`. |
| GET | `/api/admin/shops/[id]` | Shop (incl. code, phone, billing, lockout fields) with derived `state`, `days_left`, `is_trial`, plus last 50 orders, last 100 reviews, last 50 history entries and `reviewStats{count,average}`. |
| PATCH | `/api/admin/shops/[id]` | `{name?}` logs renamed. `{status: pending|active|disabled}` logs approved or disabled. `{new_pin}` (exactly 6 digits) logs pin_reset. |
| DELETE | `/api/admin/shops/[id]` | Deletes the shop (relies on DB cascades) |
| POST | `/api/admin/shops/[id]/billing` | `{months}`. New end = max(now, current sub end) + months. Sets `billing_status:'active'` and `paid_current_month:true`, and logs billing_extended. |
| GET | `/api/admin/live` | last 50 orders across shops with `shops(name, logo_url)` |
| GET | `/api/admin/reviews` | last 100 reviews with the shop name and logo |
| GET / POST / PATCH | `/api/admin/support` | GET: last 100 messages and `unread` (barista → admin). POST `{shop_id, message}` as admin. PATCH `{shop_id}` marks the barista messages read. |
| GET / PATCH | `/api/admin/contact` | read and update `global_settings.support_contact` `{email ≤120, phone ≤40}` |
| PATCH | `/api/broadcast` | admin. `{active, message}` upserts `global_settings.broadcast` and inserts `broadcast_history` (if a message is present). |

---

## 7. Key flows

**Signup → approval → login**
1. `/setup` sends `POST /api/shops` (pending, 15-day trial) and lands on `/pending`.
2. The admin opens `/admin/shops/[id]` and clicks **Approve**, which sends `PATCH {status:'active'}`.
3. The barista logs in at `/barista` (`POST /api/auth`), gets the cookie and lands on `/barista/dashboard`.

**Order lifecycle**
1. The dashboard sends `POST /api/orders`. The RPC `create_order` claims the number and sets `has_created_order`.
2. The QR modal shows `/<host>/o/<orderId>`.
3. The customer opens it: `GET /api/o/[id]`, then `POST /connect` (the dashboard dot turns green).
4. Optionally, the customer enables sound and push (`/api/push/subscribe`).
5. The barista clicks **Mark ready**: `PATCH /api/orders/[id] {status:'ready'}` sets `ready_at`. `after()` sends web-push to every subscription for the order (dead endpoints are pruned).
6. The customer's poll (4 s) sees `ready`: sound, vibration, title flash, badge. If the app is in the background, the SW shows a notification (`requireInteraction`, vibrate, badge). Clicking it focuses or opens `/o/<id>` and clears the badge.
7. The customer taps **Got it**: acknowledged, review prompt, then `/o/latest` after 7 s.
8. The barista clicks **Picked up**: `status:'done'`. The order leaves the list and its number is freed.
- Alternative: a customer cancel after 20 min of preparing also sets `done`.

**Expiry**
- `requireShop` fails with 403. The dashboard catches it on any call and redirects to `/expired`.
- On `/expired`, support chat still works (`requireShopAuth`).
- The admin extends billing at `/admin/shops/[id]`.

**Broadcast**: the admin sets the banner at `/admin/broadcast`. `BroadcastBanner` on the dashboard shows it, and it is dismissible per message text.

---

## 8. Components, lib, hooks

### `src/components`
| File | Purpose |
|---|---|
| `BroadcastBanner.tsx` | Polls `/api/broadcast` (60 s while visible, plus on visibility) and shows a dismissible banner (dismissal keyed by message) |
| `CatchBeans.tsx` | Waiting mini-game: drag a cup to catch falling beans, 3 lives, speed ramps up, best score in localStorage |
| `CozyPattern.tsx` | SVG coffee-bean background pattern (cozy palette) |
| `CupLogo.tsx` | App logo image (`/logo.png`) |
| `LanguageSwitcher.tsx` | fr/ar/en switcher (`compact` variant) |
| `Logo.tsx` | Shop logo with scale/offset transform, falling back to an initial letter |
| `LogoAdjuster.tsx` | Sliders and drag for logo scale and offset |
| `LogoUploader.tsx` | File pick, square crop to a 2D canvas, PNG blob, `POST /api/shops/[id]/logo` |
| `NotificationSetup.tsx` | SW registration, permission prompt, VAPID subscribe, `/api/push/subscribe` |
| `OnboardingChecklist.tsx` | Dashboard checklist (logo uploaded, first order created) |
| `QrScanner.tsx` | Full-screen camera (`getUserMedia`) and jsQR decode loop |
| `ReviewPrompt.tsx` | 3-face rating plus optional comment, `POST /api/reviews`, one per order (localStorage) |
| `SupportModal.tsx` | Barista ↔ admin chat (polls 5 s, marks read) |
| `ui/ConfirmDialog.tsx` | Confirm modal (default/danger variants, loading). Used by admin shop detail. |
| `ui/Modal.tsx` | Generic modal, used by `ConfirmDialog` (the dashboard has its own local one) |
| `ui/SearchBar.tsx` | Search input (admin home) |
| `ui/Toast.tsx` | Toast stack (`ToastItem`, `ToastKind`). Used with `hooks/useToasts`. |

### `src/lib`
| File | Purpose |
|---|---|
| `admin-auth.ts` | Admin cookie sign/verify, `isAdminAuthed()`, `ADMIN_COOKIE`, `ADMIN_MAX_AGE` |
| `shop-auth.ts` | Shop cookie sign/verify, `getShopSession`, `requireShopAuth`, `requireShop`, `SHOP_COOKIE`, `SHOP_MAX_AGE` |
| `pin.ts` | `hashPin` (v2 scrypt + salt + pepper), `verifyPin` (v2, v1w, legacy hex → `{ok, needsRehash}`). Node runtime only. |
| `config.ts` | `MONTHLY_PRICE_TND`, `DEV_LAN_IP` (env-driven settings) |
| `public-order.ts` | `getPublicOrder(id)`: customer-safe order and shop (no shop id), used by `/api/o/[id]` and the `/o/[id]` server render |
| `rate-limit.ts` | `createRateLimiter(scope, max, windowMs)`, persisted in `global_settings` |
| `supabase-admin.ts` | Service-role client (server only!) |
| `send-push.ts` | `sendOrderReadyPush(orderId)`: VAPID config, sends to all subscriptions, prunes 404/410 |
| `badge.ts` | `setBadge`, `clearBadge`, `supportsBadge` (App Badging API) |
| `themes.ts` | **Source of truth for the `Shop` client type.** `PALETTES` (stone [default], espresso, olive, clay, ink, cream, cozy [bean pattern]), `FONTS` (sans "Modern", serif "Editorial", display "Distinct"), `DEFAULT_THEME`, `getPalette`, `getFont`, `paletteVars` (`--bg --surface --surface-muted --border --text --text-muted --primary --primary-text --accent --accent-soft`) |
| `i18n/translations.ts` | `Locale = fr|ar|en`, `LOCALES` (with `dir`), `DEFAULT_LOCALE='fr'`, `translations` dict, `TranslationKey = keyof translations.fr`, `formatTemplate()` |
| `i18n/context.tsx` | `I18nProvider` (reads `cup-locale` after mount, sets `<html lang/dir>`, toggles `font-arabic` on body), `useI18n()`, `useT()`. `t(key, {var})` replaces `%var` and falls back to fr, then to the key. |

Translation namespaces: `admin.*` (largest), `cz.*` (customize), `setup.*`, `cust.*` (customer page), `dash.*`, `landing.*`, `pending.*`, `order.*`, `onboarding.*`, `login.*`, `review.*`, `common.*`, `support.*`, `live.*`, `notif.*`, `game.*`, `expired.*`, `scan.*`, `noOrder.*`, `qr.*`, `error.*`, `notFound.*`, `billing.*`, `banner.*`. **New UI strings must be added to all three locales** (fr is the fallback).

### `src/hooks`
- `useElapsed(startIso, endIso?)` returns elapsed **seconds** (ticks every 1 s unless `endIso` is set). `formatElapsed(sec)` gives `45s`, `3m 12s` or `1h 03m`.
- `useToasts()` returns `{toasts, push(kind, msg), dismiss(id)}`.

### `public/`
`sw.js` (push and notificationclick), `ready.mp3` (ringtone, cached 1 day via `next.config.ts`), `icon-192/512.png`, `apple-icon.png`, `logo.png`.

---

## 9. Conventions to follow

- Every API route uses `supabaseAdmin` and checks auth with the right guard **first**. Use `requireShop` for anything that should stop working when a shop expires, and `requireShopAuth` only for support.
- Never expose `shops.id` in public (customer) payloads. The shop id is effectively the key to the shop routes.
- Return `NextResponse.json({ error }, { status })`. Wrap handlers in try/catch that returns `{error: message}` 500. Use `Cache-Control: no-store` on live data.
- Route params: `ctx: { params: Promise<{ id: string }> | { id: string } }` and `await ctx.params`.
- Realtime uses **polling** (Supabase realtime channels were removed for security). Poll only while `document.visibilityState === 'visible'`, refresh on focus, and guard against in-flight requests.
- Pages are `'use client'`. Barista identity comes from localStorage `shop_id` plus the cookie. Handle 401 by clearing the cache and going to `/barista`. Handle 403 by going to `/expired`.
- RTL-safe Tailwind: use `ms-/me-/ps-/pe-/start-/end-`, `rtl:rotate-180` on arrows, `text-start`.
- Palette: the barista and marketing UI use `stone` on `#faf7f2`, the admin UI uses `zinc` on `zinc-50`, and the customer page uses CSS vars from the shop theme.
- Commit style: conventional-ish (`feat(scope):`, `fix:`, `security:`, `perf:`).

---

## 10. Known issues / gotchas

Fixed on 2026-10-25 (first pass): shop routes are guarded with `requireShop`, `/pending` uses the `/status` endpoint, the stale-order threshold is in seconds, and customize autosave uses a key-order-insensitive `sameJson` (this also stopped a save loop).

Fixed on 2026-10-25 (cleanup branch):
- Expired shops now get the session cookie on login, so support chat on `/expired` works.
- Removed the legacy `/push/subscribe` and `/api/o/[id]/manifest` routes.
- `/o/[id]` is server-rendered (no loader and no second request on first paint).
- The admin login rate limit is persisted in the DB.
- Hard-coded support email, LAN IP and price moved to env (`.env.example` added).
- Deleted dead code: `lib/types.ts`, `lib/supabase.ts`, `ThemeProvider`, `ClientOnly`, empty `public/ringtones/`.
- `BroadcastBanner` no longer opens a Supabase realtime channel with the anon key (it polls).
- Reconstructed schema added at `supabase/schema.sql`.

Still open:
1. **PIN hashing**: done and live (2026-10-25). Every row is `v1w` or `v2`; `v1w` upgrades to `v2` on login. Leftover cleanup: remove the legacy-hex branch from `verifyPin` (see `docs/pin-hash-migration.md`).
2. `supabase/schema.sql` is reconstructed, not dumped. Run the `supabase db dump` command in its header, and from then on put changes in `supabase/migrations/`.
3. Lint: `react-hooks/set-state-in-effect` errors in the dashboard and `BroadcastBanner` (pre-existing pattern).
4. After deleting routes, `.next/types` is stale until the next `dev`/`build` (`tsc` complains about the missing routes).
