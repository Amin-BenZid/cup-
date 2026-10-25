-- =============================================================================
-- Cup — database schema (RECONSTRUCTED FROM APPLICATION CODE, 2026-10-25)
-- =============================================================================
-- The live schema only exists in Supabase. This file was rebuilt from the
-- queries in src/ so the repo has a reference. It is NOT a verified dump:
-- column types, defaults, indexes and RLS may differ from production.
--
-- Replace it with the real thing as soon as you can (needs the DB password
-- from Supabase → Project Settings → Database):
--
--   npx supabase db dump --db-url "postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres" -f supabase/schema.sql
--
-- After that, every schema change goes in supabase/migrations/<timestamp>_<name>.sql.
-- All app access is server-side with the service-role key, so RLS is not
-- relied on (but should stay enabled with no anon policies).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- shops
create table if not exists public.shops (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  tagline              text,
  code                 text not null unique,          -- login slug
  pin_hash             text not null,                 -- v2$scrypt$… (see src/lib/pin.ts)
  status               text not null default 'pending'
                         check (status in ('pending','active','disabled')),
  phone                text,
  logo_url             text,
  logo_scale           real,
  logo_offset_x        real,
  logo_offset_y        real,
  theme                jsonb,                          -- { palette, font, primary? }
  game                 text default 'catch-beans',     -- 'catch-beans' | 'none'
  messages             jsonb,                          -- { preparing?, ready? }
  trial_ends_at        timestamptz,
  subscription_ends_at timestamptz,
  billing_status       text default 'trial',           -- 'trial' | 'active'
  paid_current_month   boolean default false,
  login_attempts       integer not null default 0,
  locked_until         timestamptz,
  has_created_order    boolean not null default false,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references public.shops(id) on delete cascade,
  order_number       text not null,                   -- 1–4 digits
  status             text not null default 'preparing'
                       check (status in ('preparing','ready','done')),
  customer_connected boolean not null default false,
  customer_phone     text,
  created_at         timestamptz not null default now(),
  ready_at           timestamptz
);
-- One active (not done) order per number per shop. Violations surface as 23505
-- → DUPLICATE_ORDER_NUMBER in POST /api/orders.
create unique index if not exists orders_active_number_per_shop
  on public.orders (shop_id, order_number) where status <> 'done';
create index if not exists orders_shop_created on public.orders (shop_id, created_at desc);

-- ---------------------------------------------------------------- reviews
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references public.orders(id) on delete cascade,
  shop_id    uuid not null references public.shops(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 3),
  comment    text check (char_length(comment) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- push_subscriptions
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- support_messages
create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  message    text not null,
  sender     text not null check (sender in ('barista','admin')),
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- global_settings
-- Keys: 'broadcast' {active,message}, 'support_contact' {email,phone},
--       'rl:<scope>:<hash>' {count,reset_at} (rate limits, src/lib/rate-limit.ts)
create table if not exists public.global_settings (
  key   text primary key,
  value jsonb
);

-- ---------------------------------------------------------------- broadcast_history
create table if not exists public.broadcast_history (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- shop_history
create table if not exists public.shop_history (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  action     text not null,   -- created|renamed|approved|disabled|pin_reset|billing_extended
  details    jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- client_errors
create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  message    text,
  stack      text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- storage
-- Public bucket 'logos', objects at logos/<shop_id>/<ts>.<ext>.

-- ---------------------------------------------------------------- RPCs
-- Bodies are not in the repo. Signatures and contracts as used by the app:
--
-- create_order(p_shop_id uuid, p_number text, p_phone text) returns orders
--   If p_number is null/empty, claims the next free number for the shop.
--   Inserts the order, sets shops.has_created_order = true, returns the row.
--   Raises 23505 if p_number is already active for that shop.
--
-- peek_order_number(p_shop_id uuid) returns text
--   Same "next number" logic as create_order, without claiming it.
--
-- admin_shop_stats() returns table(
--   shop_id uuid, orders_total bigint, orders_7d bigint, orders_30d bigint,
--   orders_today bigint, last_order_at timestamptz,
--   rating_avg numeric, rating_count bigint)
