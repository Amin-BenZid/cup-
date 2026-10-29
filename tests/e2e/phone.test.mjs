const B = 'http://localhost:3100', PG = 'http://127.0.0.1:54321'
let fails = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) fails++ }
const rip = () => `6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const req = async (method, path, body, headers = {}) => { const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': rip(), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); return { r, j: await r.json().catch(() => ({})) } }
const dump = async () => (await fetch(PG + '/__dump')).json()
let admin = ''
{ const { r } = await req('POST', '/api/admin/login', { password: 'test-password-123' }, { origin: B }); admin = (r.headers.get('set-cookie') || '').split(';')[0] }
async function mk(n) {
  const { j } = await req('POST', '/api/shops', { name: n, pin: '112233' }); const s = j.shop
  await fetch(`${PG}/rest/v1/shops?id=eq.${s.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
  const { r } = await req('POST', '/api/auth', { code: s.code, pin: '112233' }); s.cookie = (r.headers.get('set-cookie') || '').split(';')[0]; return s
}
const tag = Math.random().toString(36).slice(2, 5)
const S = await mk('Phone Shop ' + tag), O = await mk('Other Shop ' + tag)

let { r, j } = await req('GET', `/api/shops/${S.id}`, undefined, { cookie: S.cookie })
ok('new shop: has_phone false, number not exposed', j.shop?.has_phone === false && !('phone' in j.shop), j.shop)
;({ r, j } = await req('POST', `/api/shops/${S.id}/phone`, { phone: 'abc' }, { cookie: S.cookie })); ok('invalid → 400 INVALID_PHONE', r.status === 400 && j.code === 'INVALID_PHONE', j)
;({ r, j } = await req('POST', `/api/shops/${S.id}/phone`, { phone: '123' }, { cookie: S.cookie })); ok('too short → 400', r.status === 400)
;({ r } = await req('POST', `/api/shops/${S.id}/phone`, { phone: '22 123 456' })); ok('no session → 401', r.status === 401)
;({ r } = await req('POST', `/api/shops/${S.id}/phone`, { phone: '22 123 456' }, { cookie: O.cookie })); ok("other shop's session → 403", r.status === 403)
;({ r, j } = await req('POST', `/api/shops/${S.id}/phone`, { phone: '22 123 456' }, { cookie: S.cookie })); ok('save local number → 200', r.status === 200, j)
let d = await dump()
ok('stored as +21622123456', d.shops.find((s) => s.id === S.id).phone === '+21622123456')
ok('history: phone_added', d.shop_history.some((h) => h.shop_id === S.id && h.action === 'phone_added'))
;({ r, j } = await req('POST', `/api/shops/${S.id}/phone`, { phone: '+33612345678' }, { cookie: S.cookie })); ok('second set → 409 PHONE_ALREADY_SET', r.status === 409 && j.code === 'PHONE_ALREADY_SET', j)
ok('number unchanged', (await dump()).shops.find((s) => s.id === S.id).phone === '+21622123456')
;({ j } = await req('GET', `/api/shops/${S.id}`, undefined, { cookie: S.cookie })); ok('has_phone now true', j.shop?.has_phone === true)
;({ r } = await req('POST', `/api/shops/${O.id}/phone`, { phone: '0033 6 12 34 56 78' }, { cookie: O.cookie })); ok('international 00 prefix ok', r.status === 200)
ok('stored as +33612345678', (await dump()).shops.find((s) => s.id === O.id).phone === '+33612345678')

// forgot with callback number, shop with no phone
const N = await mk('NoPhone Shop ' + tag)
;({ r, j } = await req('POST', '/api/auth/forgot', { code: N.code, phone: 'xx' })); ok('forgot invalid phone → 400', r.status === 400 && j.code === 'INVALID_PHONE')
;({ r, j } = await req('POST', '/api/auth/forgot', { code: 'nope-' + tag, phone: 'xx' })); ok('same 400 for unknown shop', r.status === 400 && j.code === 'INVALID_PHONE')
;({ r, j } = await req('POST', '/api/auth/forgot', { code: 'nope-' + tag, phone: '55 111 222' })); ok('unknown shop + phone → 200', r.status === 200 && j.ref)
;({ r, j } = await req('POST', '/api/auth/forgot', { code: N.code, phone: '55 111 222' })); ok('real shop + phone → 200', r.status === 200 && j.ref)
await new Promise((res) => setTimeout(res, 700))
;({ j } = await req('GET', `/api/admin/shops/${N.id}`, undefined, { cookie: admin }))
ok('admin sees callback number', j.shop?.pin_reset?.callback === '+21655111222', j.shop?.pin_reset)
ok("callback doesn't become the shop's phone", !j.shop.phone)
d = await dump()
ok('support message mentions it as not verified', d.support_messages.some((m) => m.shop_id === N.id && m.message.includes('+21655111222 (not verified)')))
;({ r, j } = await req('POST', '/api/auth/forgot', { code: N.code })); await new Promise((res) => setTimeout(res, 700))
;({ j } = await req('GET', `/api/admin/shops/${N.id}`, undefined, { cookie: admin }))
ok('repeat without phone keeps the callback', j.shop?.pin_reset?.callback === '+21655111222', j.shop?.pin_reset)
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exitCode = fails ? 1 : 0
