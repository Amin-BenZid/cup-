// Staff notifications: register a phone, admin support reply + broadcast reach
// it in its language (decrypted), dead devices pruned, delete removes devices.
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ece = require('http_ece')
const B = 'http://localhost:3100', PG = 'http://127.0.0.1:54321', PUSH = 'https://localhost:8443'
let fails = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) fails++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const dump = async () => (await fetch(PG + '/__dump')).json()
async function call(method, path, body, headers = {}) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': rip(), origin: B, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { r, j: await r.json().catch(() => ({})) }
}

// admin session
let admin = ''
{ const { r } = await call('POST', '/api/admin/login', { password: 'test-password-123' }); admin = (r.headers.get('set-cookie') || '').split(';')[0] }
ok('admin login', admin.startsWith('admin_session='))

async function mkShop(name) {
  const { j } = await call('POST', '/api/shops', { name, pin: '112233' })
  const s = j.shop
  await fetch(`${PG}/rest/v1/shops?id=eq.${s.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
  const { r } = await call('POST', '/api/auth', { code: s.code, pin: '112233' })
  s.cookie = (r.headers.get('set-cookie') || '').split(';')[0]
  return s
}
function device(path) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys()
  const auth = crypto.randomBytes(16)
  return { ecdh, auth, path, sub: { endpoint: `${PUSH}/${path}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } }
}
async function received(dev) {
  const log = await (await fetch(PUSH + '/__log')).json()
  return log.filter((x) => x.url === '/' + dev.path).map((x) => JSON.parse(ece.decrypt(Buffer.from(x.body, 'base64'), { version: 'aes128gcm', privateKey: dev.ecdh, authSecret: dev.auth.toString('base64url') }).toString()))
}

const tag = Math.random().toString(36).slice(2, 6)
const S = await mkShop('Notif Shop ' + tag)
const O = await mkShop('Other Shop ' + tag)
const phone = device(`staff/${tag}-ar`)
const phone2 = device(`staff/${tag}-en`)
const gone = device(`gone/${tag}`) // the fake push service answers 410 for /gone/*

// register
let { r, j } = await call('POST', `/api/shops/${S.id}/push`, { subscription: phone.sub, locale: 'ar' })
ok('no session → 401', r.status === 401)
;({ r } = await call('POST', `/api/shops/${S.id}/push`, { subscription: phone.sub, locale: 'ar' }, { cookie: O.cookie }))
ok("other shop's session → 403", r.status === 403)
;({ r, j } = await call('POST', `/api/shops/${S.id}/push`, { subscription: { endpoint: 'http://evil' }, locale: 'ar' }, { cookie: S.cookie }))
ok('bad subscription → 400', r.status === 400 && j.code === 'BAD_SUBSCRIPTION', j)
;({ r } = await call('POST', `/api/shops/${S.id}/push`, { subscription: phone.sub, locale: 'ar' }, { cookie: S.cookie }))
ok('register phone (ar) → 200', r.status === 200)
;({ r } = await call('POST', `/api/shops/${S.id}/push`, { subscription: phone.sub, locale: 'ar' }, { cookie: S.cookie }))
ok('register again is an update', r.status === 200)
await call('POST', `/api/shops/${S.id}/push`, { subscription: gone.sub, locale: 'fr' }, { cookie: S.cookie })
await call('POST', `/api/shops/${O.id}/push`, { subscription: phone2.sub, locale: 'en' }, { cookie: O.cookie })
let d = await dump()
ok('one device per endpoint', d.global_settings.filter((g) => g.key.startsWith(`shop_push:${S.id}:`)).length === 2, d.global_settings.map((g) => g.key))
ok('stored without extra fields', (() => { const v = d.global_settings.find((g) => g.key.startsWith(`shop_push:${S.id}:`))?.value; return v && Object.keys(v.subscription).sort().join() === 'endpoint,expirationTime,keys' })())

// support reply → only that shop's phones
;({ r } = await call('POST', '/api/admin/support', { shop_id: S.id, message: 'Bonjour, votre souci est réglé ✅' }, { cookie: admin }))
ok('admin reply → 200', r.status === 200)
await sleep(1500)
let got = await received(phone)
ok('support push arrives in Arabic', got.length === 1 && got[0].title === 'رسالة جديدة من الدعم', got)
ok('support push carries the message', got[0]?.body === 'Bonjour, votre souci est réglé ✅', got[0])
ok('tapping it opens the chat', got[0]?.url === '/barista/dashboard?support=1', got[0])
ok("other shop didn't get it", (await received(phone2)).length === 0)
d = await dump()
ok('dead device pruned (410)', !d.global_settings.some((g) => g.key.startsWith(`shop_push:${S.id}:`) && g.value.subscription.endpoint.includes('/gone/')))

// broadcast → every shop, once per new message
;({ r } = await call('PATCH', '/api/broadcast', { active: true, message: `Maintenance tonight ${tag}` }, { cookie: admin }))
ok('broadcast → 200', r.status === 200)
await sleep(1500)
got = await received(phone)
const got2 = await received(phone2)
ok('broadcast reaches shop 1 (ar)', got.some((p) => p.title === 'إعلان من Beep' && p.body === `Maintenance tonight ${tag}`), got)
ok('broadcast reaches shop 2 (en)', got2.some((p) => p.title === 'Beep announcement'), got2)
await call('PATCH', '/api/broadcast', { active: true, message: `Maintenance tonight ${tag}` }, { cookie: admin })
await sleep(1200)
ok('same message saved again → no second push', (await received(phone2)).length === got2.length)
;({ r } = await call('PATCH', '/api/broadcast', { active: true, message: 'x' }, {}))
ok('broadcast without admin → 401', r.status === 401)

// archived shops don't get broadcasts
await call('POST', `/api/admin/shops/${O.id}/archive`, { action: 'archive' }, { cookie: admin })
const before2 = (await received(phone2)).length
await call('PATCH', '/api/broadcast', { active: true, message: `Second ${tag}` }, { cookie: admin })
await sleep(1500)
ok('archived shop skipped', (await received(phone2)).length === before2)

// unregister
;({ r } = await call('DELETE', `/api/shops/${S.id}/push`, { endpoint: phone.sub.endpoint }, { cookie: S.cookie }))
d = await dump()
ok('unregister → removed', r.status === 200 && !d.global_settings.some((g) => g.key.startsWith(`shop_push:${S.id}:`)))

// delete forever removes the devices
await call('POST', `/api/shops/${O.id}/push`, { subscription: phone2.sub, locale: 'en' }, { cookie: O.cookie }) // archived: refused
d = await dump()
const hadO = d.global_settings.some((g) => g.key.startsWith(`shop_push:${O.id}:`))
;({ r } = await call('DELETE', `/api/admin/shops/${O.id}`, { confirm: O.code }, { cookie: admin }))
d = await dump()
ok('delete forever removes staff devices', r.status === 200 && hadO && !d.global_settings.some((g) => g.key.startsWith(`shop_push:${O.id}:`)), { status: r.status, hadO })

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
