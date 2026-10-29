// End-to-end tests of admin security against `next start` + mockpg.
import crypto from 'node:crypto'

const BASE = 'http://localhost:3100'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) }
}

let cookie = ''
async function call(path, { method = 'GET', body, origin, useCookie = true, headers = {}, ip = '1.1.1.1' } = {}) {
  const h = { 'x-forwarded-for': ip, ...headers }
  if (body !== undefined) h['content-type'] = 'application/json'
  if (useCookie && cookie) h.cookie = cookie
  if (origin !== undefined) h.origin = origin
  else if (method !== 'GET') h.origin = BASE
  const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const set = res.headers.get('set-cookie')
  let json = {}
  try { json = await res.json() } catch {}
  return { status: res.status, json, set }
}
const takeCookie = (set) => { const m = /admin_session=([^;]*)/.exec(set || ''); return m ? `admin_session=${m[1]}` : '' }

// TOTP (same as src/lib/totp.ts)
const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function b32d(s) { let bits = 0, v = 0; const out = []; for (const ch of s.replace(/[^A-Z2-7]/g, '')) { v = (v << 5) | ALPH.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8 } } return Buffer.from(out) }
function totp(secret, offset = 0) {
  const c = Math.floor(Date.now() / 30000) + offset
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(c))
  const h = crypto.createHmac('sha1', b32d(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  return ((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).toString().padStart(6, '0')
}

// --- unauthenticated
ok('badges 401 without cookie', (await call('/api/admin/badges')).status === 401)
ok('overview 401 without cookie', (await call('/api/admin/overview')).status === 401)
ok('shops 401 without cookie', (await call('/api/admin/shops')).status === 401)
ok('2fa 401 without cookie', (await call('/api/admin/2fa')).status === 401)
ok('login GET says no 2FA', (await call('/api/admin/login')).json.twoFactor === false)

// --- wrong password then right
let r = await call('/api/admin/login', { method: 'POST', body: { password: 'nope' }, ip: '2.2.2.2' })
ok('wrong password 401', r.status === 401 && !r.set)
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123' }, ip: '2.2.2.2' })
ok('right password 200 + cookie', r.status === 200 && /admin_session=v2\./.test(r.set || ''), r.status)
ok('cookie flags HttpOnly + SameSite=Lax', /HttpOnly/i.test(r.set) && /SameSite=lax/i.test(r.set))
cookie = takeCookie(r.set)
ok('session GET 200 with cookie', (await call('/api/admin/session')).status === 200)
ok('badges 200 with cookie', (await call('/api/admin/badges')).status === 200)

// --- CSRF / origin
ok('PATCH settings with evil Origin → 403', (await call('/api/admin/settings', { method: 'PATCH', body: { notify: { signup: false } }, origin: 'https://evil.example' })).status === 403)
ok('PATCH settings same origin → 200', (await call('/api/admin/settings', { method: 'PATCH', body: { notify: { signup: false } } })).status === 200)
ok('settings persisted', (await call('/api/admin/settings')).json.notify?.signup === false)
ok('invalid contact email → 400', (await call('/api/admin/settings', { method: 'PATCH', body: { contact: { email: 'x', phone: '' } } })).status === 400)

// --- forged / tampered cookies
const saved = cookie
cookie = saved.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
ok('tampered signature → 401', (await call('/api/admin/session')).status === 401)
cookie = 'admin_session=' + Date.now() + '.' + 'f'.repeat(64)
ok('old v1 format → 401', (await call('/api/admin/session')).status === 401)
cookie = saved

// --- push subscribe validation
ok('push: invalid subscription → 400', (await call('/api/admin/push', { method: 'POST', body: { subscription: { endpoint: 'http://x' } } })).status === 400)
r = await call('/api/admin/push', { method: 'POST', body: { subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }, label: 'Test phone' } })
ok('push: valid subscription saved', r.status === 200 && r.json.key?.startsWith('admin_push:'))
r = await call('/api/admin/push')
ok('push: device listed', r.json.devices?.length === 1 && r.json.devices[0].label === 'Test phone')
ok('push: device removed', (await call('/api/admin/push', { method: 'DELETE', body: { key: r.json.devices[0].key } })).status === 200)

// --- 2FA enrol
r = await call('/api/admin/2fa', { method: 'POST', body: { action: 'begin' } })
ok('2fa begin returns secret + uri', r.status === 200 && /^[A-Z2-7]{32}$/.test(r.json.secret) && r.json.uri.startsWith('otpauth://totp/'))
const secret = r.json.secret
ok('2fa confirm with wrong code → 400', (await call('/api/admin/2fa', { method: 'POST', body: { action: 'confirm', code: '000000' } })).status === 400)
ok('2fa confirm with right code → 200', (await call('/api/admin/2fa', { method: 'POST', body: { action: 'confirm', code: totp(secret) } })).status === 200)
ok('2fa status enabled', (await call('/api/admin/2fa')).json.enabled === true)
const dump = await (await fetch('http://127.0.0.1:54321/__dump')).json()
const stored = JSON.stringify(dump.global_settings.find((x) => x.key === 'admin_totp'))
ok('TOTP secret not stored in plaintext', stored && !stored.includes(secret))
ok('login GET now says 2FA', (await call('/api/admin/login', { useCookie: false })).json.twoFactor === true)

// --- login with 2FA
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123' }, useCookie: false, ip: '3.3.3.3' })
ok('password only → 401 when 2FA on', r.status === 401 && r.json.twoFactor === true && !r.set)
r = await call('/api/admin/login', { method: 'POST', body: { password: 'wrong', code: totp(secret, 1) }, useCookie: false, ip: '3.3.3.3' })
ok('wrong password + valid code → 401', r.status === 401)
const code = totp(secret, 1)
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123', code }, useCookie: false, ip: '3.3.3.3' })
ok('password + code → 200 (code not burnt by wrong-password try)', r.status === 200 && !!r.set, r.status + JSON.stringify(r.json))
const cookie2 = takeCookie(r.set)
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123', code }, useCookie: false, ip: '3.3.3.3' })
ok('same code replayed → 401', r.status === 401)

// --- revoke all sessions
cookie = cookie2
ok('second session works', (await call('/api/admin/session')).status === 200)
r = await call('/api/admin/session', { method: 'DELETE' })
ok('logout all devices → 200', r.status === 200)
await new Promise((res) => setTimeout(res, 50))
ok('revoked session → 401', (await call('/api/admin/session')).status === 401)
cookie = saved
ok('first session also revoked', (await call('/api/admin/session')).status === 401)

// --- rate limit
for (let i = 0; i < 5; i++) await call('/api/admin/login', { method: 'POST', body: { password: 'bad' }, useCookie: false, ip: '9.9.9.9' })
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123', code: totp(secret) }, useCookie: false, ip: '9.9.9.9' })
ok('6th attempt from same IP → 429 even with right creds', r.status === 429)
// The last accepted code was for the *next* 30 s window; wait for a fresh one.
{ const c0 = Math.floor(Date.now() / 30000); while (Math.floor(Date.now() / 30000) === c0) await new Promise((r) => setTimeout(r, 500)) }
r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-password-123', code: totp(secret, 1) }, useCookie: false, ip: '8.8.8.8' })
ok('other IP still can log in', r.status === 200, r.status + JSON.stringify(r.json))
cookie = takeCookie(r.set)

// --- disable 2FA needs a code
ok('disable 2FA wrong code → 400', (await call('/api/admin/2fa', { method: 'POST', body: { action: 'disable', code: '123456' } })).status === 400)

// --- cron
ok('cron without CRON_SECRET configured → 401', (await call('/api/cron/daily', { useCookie: false, headers: { authorization: 'Bearer anything' } })).status === 401)

// --- audit log
r = await call('/api/admin/activity')
const events = (r.json.audit || []).map((a) => a.event)
ok('audit has login, login_failed, 2fa_enabled, logout_all_devices', ['login', 'login_failed', '2fa_enabled', 'logout_all_devices'].every((e) => events.includes(e)), events.join(','))

// --- headers
const h = await fetch(BASE + '/admin/login')
ok('X-Frame-Options DENY', h.headers.get('x-frame-options') === 'DENY')
ok('nosniff', h.headers.get('x-content-type-options') === 'nosniff')
ok('admin noindex', (h.headers.get('x-robots-tag') || '').includes('noindex'))
const mf = await fetch(BASE + '/admin/manifest.webmanifest')
const mj = await mf.json()
ok('admin manifest start_url /admin', mj.start_url === '/admin' && mj.display === 'standalone')
const html = await (await fetch(BASE + '/admin/login')).text()
ok('admin pages link admin manifest', html.includes('/admin/manifest.webmanifest'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
