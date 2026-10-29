// Translations: server error codes, customer push language (decrypted).
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ece = require('http_ece')
const B = 'http://localhost:3100', PG = 'http://127.0.0.1:54321'
let fails = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) fails++ }
const rip = () => `9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const post = async (path, body, headers = {}) => { const r = await fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': rip(), ...headers }, body: JSON.stringify(body) }); return { r, j: await r.json().catch(() => ({})) } }

// error codes
let { r, j } = await post('/api/auth', { code: 'no-such-cafe-xyz', pin: '123456' })
ok('login wrong → INVALID_CREDENTIALS', r.status === 401 && j.code === 'INVALID_CREDENTIALS', j)
;({ r, j } = await post('/api/shops', { name: '', pin: '123456' })); ok('signup no name → NAME_REQUIRED', j.code === 'NAME_REQUIRED', j)
;({ r, j } = await post('/api/shops', { name: 'X', pin: '12' })); ok('signup short pin → PIN_LENGTH', j.code === 'PIN_LENGTH', j)

// café + session
const name = 'I18n Cafe ' + Math.random().toString(36).slice(2, 5)
;({ j } = await post('/api/shops', { name, pin: '112233' })); const shop = j.shop
await fetch(`${PG}/rest/v1/shops?id=eq.${shop.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
;({ r } = await post('/api/auth', { code: shop.code, pin: '112233' }))
const cookie = (r.headers.get('set-cookie') || '').split(';')[0]
;({ r, j } = await post('/api/orders', { shop_id: shop.id, order_number: '12345' }, { cookie })); ok('order number too long → INVALID_NUMBER', j.code === 'INVALID_NUMBER', j)
;({ r, j } = await post('/api/orders', { shop_id: shop.id, customer_phone: 'abc' }, { cookie })); ok('bad phone → INVALID_PHONE', j.code === 'INVALID_PHONE', j)

// lockout code: 5+ wrong PINs
let last
for (let i = 0; i < 7; i++) last = await post('/api/auth', { code: shop.code, pin: '000000' })
ok('lockout → TOO_MANY_ATTEMPTS', last.r.status === 429 && last.j.code === 'TOO_MANY_ATTEMPTS', last.j)

// customer push in their language
await fetch(`${PG}/rest/v1/shops?id=eq.${shop.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login_attempts: 0, locked_until: null }) })
async function pushFor(locale) {
  const ins = await fetch(`${PG}/rest/v1/orders`, { method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=representation' }, body: JSON.stringify({ shop_id: shop.id, order_number: String(Math.floor(Math.random() * 900) + 10), status: 'preparing' }) })
  const order = (await ins.json())[0]
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys()
  const auth = crypto.randomBytes(16)
  const path = `cust/${locale ?? 'none'}-${order.id}`
  const sub = { endpoint: `https://localhost:8443/${path}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } }
  const body = { order_id: order.id, subscription: sub }; if (locale) body.locale = locale
  ;({ r } = await post('/api/push/subscribe', body))
  ok(`subscribe (${locale ?? 'no locale'}) 200`, r.status === 200)
  const r2 = await fetch(`${B}/api/orders/${order.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ status: 'ready' }) })
  ok(`order ready (${locale}) 200`, r2.status === 200, await r2.text())
  await new Promise((res) => setTimeout(res, 1500))
  const log = await (await fetch('https://localhost:8443/__log')).json()
  const hit = log.find((x) => x.url === '/' + path)
  if (!hit) return null
  const plain = ece.decrypt(Buffer.from(hit.body, 'base64'), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth.toString('base64url') })
  return JSON.parse(plain.toString())
}
const ar = await pushFor('ar'); ok('Arabic customer gets Arabic push', ar?.title === 'طلبك جاهز' && ar.body === 'استلمه من الكاونتر', ar)
const en = await pushFor('en'); ok('English customer gets English push', en?.title === 'Your order is ready', en)
const fr = await pushFor('fr'); ok('French customer gets French push', fr?.title === 'Votre commande est prête', fr)
const none = await pushFor(null); ok('no language saved → French (app default)', none?.title === 'Votre commande est prête', none)
ok('push opens the order page', ar?.url?.startsWith('/o/'))
const dump = await (await fetch(PG + '/__dump')).json()
const row = dump.push_subscriptions.find((p) => p.endpoint.includes('/cust/ar-'))
ok('stored subscription keeps only endpoint/keys/locale', row && Object.keys(row.subscription).sort().join() === 'endpoint,expirationTime,keys,locale', row?.subscription)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exitCode = fails ? 1 : 0
