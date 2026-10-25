# PIN hash migration plan

Status: **done, live on prod (2026-10-25).** All legacy hashes wrapped to `v1w`, and the login upgrade to `v2` is verified on prod. No backup table was created (none needed). Remaining: remove the raw-hex branch from `verifyPin` (no rows use it). Owner: Amin.

## Problem

`shops.pin_hash` is `sha256(pin)` in hex, with no salt and no secret
(`src/lib/hash.ts`). A PIN has 6 digits, so there are only 1,000,000 possible
values. If the `shops` table ever leaks (backup, misconfigured key, SQL
injection elsewhere), one precomputed table of 1M hashes reveals **every**
shop's PIN instantly. Two shops with the same PIN also get the same hash.

Salting alone doesn't fix this: a 6-digit space is small enough to brute-force
per shop even with a slow hash. So the target is **slow hash + per-shop salt +
server-side pepper**. The pepper lives only in the Vercel env, so a DB leak on
its own isn't enough to crack anything.

## Target format

Stored in the existing `pin_hash` text column (no schema change needed):

```
v2$scrypt$N=16384,r=8,p=1$<salt b64url>$<hash b64url>
```

- `key = HMAC-SHA256(PIN_PEPPER, pin)`, then `hash = scrypt(key, salt, 32, {N, r, p})`.
- `salt` = 16 random bytes per shop, regenerated on every PIN change.
- scrypt is in Node's `crypto`, so there are no new dependencies. Routes that
  call it must run on the Node runtime (they already do, nothing sets `edge`).
- Parameters live in the string, so they can be raised later without another migration.

There's also a transitional format for rows we upgrade without knowing the PIN:

```
v1w$scrypt$N=16384,r=8,p=1$<salt>$<hash>      # hash = scrypt(HMAC(PEPPER, sha256hex(pin)), salt)
```

## Code changes (one PR)

1. **`src/lib/hash.ts`** → replace with `src/lib/pin.ts`:
   - `hashPin(pin): Promise<string>` returns `v2$…`.
   - `verifyPin(pin, stored): Promise<{ ok: boolean; needsRehash: boolean }>`
     accepts all three formats:
     - `v2$…` → normal verify. `needsRehash` is true if the params are below current.
     - `v1w$…` → verify against `sha256hex(pin)` as input. `needsRehash: true`.
     - 64-char hex (legacy) → `sha256hex(pin) === stored`. `needsRehash: true`.
     - Compare with `crypto.timingSafeEqual`.
2. **`POST /api/auth`**: use `verifyPin`. On success with `needsRehash`, write
   `hashPin(pin)` to `pin_hash` (in the same update that resets `login_attempts`).
3. **`POST /api/shops`** (signup) and **`PATCH /api/admin/shops/[id]`** (`new_pin`):
   use the new `hashPin`. Nothing else reads `pin_hash`.
4. **Env**: add `PIN_PEPPER` (32+ random bytes, `openssl rand -base64 32`) to
   Vercel prod/preview and `.env.local`. **Back it up**: losing it locks every shop out.
   `hashPin` must throw if it is missing, never fall back to no pepper.

## Rollout

| Step | What | Rollback |
|---|---|---|
| 0 | **Backup.** `create table shops_pin_backup as select id, pin_hash, now() as taken_at from shops;` | n/a |
| 1 | Set `PIN_PEPPER` in Vercel. Deploy the PR. Logins keep working (legacy hashes verify). New signups, PIN resets and every successful login now write `v2`. | Revert the deploy. Legacy rows still verify. `v2` rows would fail on old code, so restore those from the backup (only for shops that logged in since step 1) or reset their PINs. |
| 2 | **Wrap the rest right away** so no weak hash stays in the DB. Run a one-off script (Node, service-role key): for each row where `pin_hash ~ '^[0-9a-f]{64}$'`, set `pin_hash = v1w(hash)`. Batches of 100, using `where pin_hash = <old>` so a concurrent login upgrade isn't overwritten. | Restore from `shops_pin_backup` for rows still `v1w`. |
| 3 | Verify: `select count(*) from shops where pin_hash ~ '^[0-9a-f]{64}$';` → **0**. Log in with a test shop in each state (legacy-wrapped, v2, fresh signup, admin reset). | |
| 4 | After about 2 weeks with no issues: `drop table shops_pin_backup;`. `v1w` rows upgrade to `v2` on next login. Remove the raw-hex branch from `verifyPin`, but keep `v1w` while any rows still use it. | |

## Cost / limits

- scrypt N=16384 takes about 30–60 ms and 16 MB per verify on a Vercel function.
  It only runs on login, signup and PIN reset. That's fine.
- Online brute force is still limited by the existing per-shop lockout
  (5 failures → 15 min). That doesn't change.
- This protects against a **DB leak**. It does not make a 6-digit PIN strong
  against someone who also has `PIN_PEPPER`. If that matters later, allow
  longer PINs (8 digits or alphanumeric). The format above handles it without
  another migration.

## Test checklist

- [ ] Legacy hex hash: login works, and the row becomes `v2` afterwards
- [ ] `v1w` wrapped hash: login works, and the row becomes `v2`
- [ ] Wrong PIN on each format: 401, and the attempt counter increments
- [ ] Signup stores `v2`. Admin PIN reset stores `v2` with a new salt
- [ ] Missing `PIN_PEPPER`: signup/login return 500, never store an unpeppered hash
- [ ] Same PIN on two shops produces different `pin_hash`
