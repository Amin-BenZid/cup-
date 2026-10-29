// Forgot-PIN flow against next start + mockpg.
const B = 'http://localhost:3100', PG = 'http://127.0.0.1:54321'
let fails = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) fails++ }
const dump = async () => (await fetch(PG + '/__dump')).json()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rip = () => `8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

async function forgot(code, ip = rip()) {
  const r = await fetch(B + '/api/auth/forgot', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ code }) })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const login = (code, pin) => fetch(B + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': rip() }, body: JSON.stringify({ code, pin }) })

let cookie = ''
async function admin(path, { method = 'GET', body } = {}) {
  const h = { 'x-forwarded-for': rip(), origin: B }
  if (body !== undefined) h['content-type'] = 'application/json'
  if (cookie) h.cookie = cookie
  const r = await fetch(B + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const m = /admin_session=([^;]*)/.exec(r.headers.get('set-cookie') || ''); if (m) cookie = `admin_session=${m[1]}`
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
await admin('/api/admin/login', { method: 'POST', body: { password: 'test-password-123' } })

async function mk(name) {
  const r = await fetch(B + '/api/shops', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': rip() }, body: JSON.stringify({ name, pin: '112233' }) })
  const s = (await r.json()).shop
  await fetch(`${PG}/rest/v1/shops?id=eq.${s.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active', phone: '+21655123456' }) })
  return s
}
const tag = Math.random().toString(36).slice(2, 6)
const S = await mk('Forgot Cafe ' + tag)
const before = await dump()

// --- unknown code: same answer, nothing written
let r = await forgot('no-such-cafe-' + tag)
ok('unknown code → 200 + ref', r.status === 200 && /^[A-Z2-9]{6}$/.test(r.json.ref), r)
const keysUnknown = Object.keys(r.json).sort().join()
await sleep(400)
let d = await dump()
ok('unknown code writes nothing', d.support_messages.length === before.support_messages.length && !d.global_settings.some((g) => g.key.startsWith('pin_reset_request:')))

// --- known code (typed with spaces / caps)
r = await forgot(S.code.replace(/-/g, ' ').toUpperCase())
ok('known code → 200 + ref', r.status === 200 && /^[A-Z2-9]{6}$/.test(r.json.ref), r)
ok('same response shape as unknown', Object.keys(r.json).sort().join() === keysUnknown)
const ref1 = r.json.ref
await sleep(600)
d = await dump()
const req1 = d.global_settings.find((g) => g.key === 'pin_reset_request:' + S.id)?.value
ok('request stored with ref', req1?.ref === ref1 && req1.refs?.[0] === ref1, req1)
const msgs = d.support_messages.filter((m) => m.shop_id === S.id)
ok('support message posted (unread) with ref', msgs.length === 1 && msgs[0].message.includes(ref1) && msgs[0].is_read === false && msgs[0].sender === 'barista', msgs)
ok('history logged', d.shop_history.some((h) => h.shop_id === S.id && h.action === 'pin_reset_requested'))
ok('PIN unchanged — old PIN still works', (await login(S.code, '112233')).status === 200)

// --- again within cooldown: new ref, no second message
r = await forgot(S.code)
ok('repeat → different ref (no enumeration)', r.status === 200 && r.json.ref !== ref1)
const ref2 = r.json.ref
await sleep(600)
d = await dump()
const req2 = d.global_settings.find((g) => g.key === 'pin_reset_request:' + S.id)?.value
ok('both refs kept', req2.refs.includes(ref1) && req2.refs.includes(ref2), req2)
ok('no second support message', d.support_messages.filter((m) => m.shop_id === S.id).length === 1)

// --- admin sees it
r = await admin(`/api/admin/shops/${S.id}`)
ok('admin detail shows request', r.json.shop?.pin_reset?.refs?.includes(ref2), r.json.shop?.pin_reset)
r = await admin('/api/admin/shops')
ok('admin list flags request', r.json.shops.find((s) => s.id === S.id)?.pin_reset_requested === true)

// --- unrelated edit keeps the request
r = await admin(`/api/admin/shops/${S.id}`, { method: 'PATCH', body: { tagline: 'hello' } })
ok('unrelated edit keeps request', r.status === 200 && r.json.shop.pin_reset?.refs?.length === 2, r.json.shop?.pin_reset)

// --- admin sets a new PIN → request cleared, new PIN works, old doesn't
r = await admin(`/api/admin/shops/${S.id}`, { method: 'PATCH', body: { new_pin: '445566' } })
ok('new PIN set', r.status === 200 && r.json.shop.pin_reset === null, r)
d = await dump()
ok('request cleared', !d.global_settings.some((g) => g.key === 'pin_reset_request:' + S.id))
ok('new PIN logs in', (await login(S.code, '445566')).status === 200)
ok('old PIN refused', (await login(S.code, '112233')).status === 401)

// --- dismiss
await forgot(S.code); await sleep(600)
ok('new request after reset', !!(await dump()).global_settings.find((g) => g.key === 'pin_reset_request:' + S.id))
r = await admin(`/api/admin/shops/${S.id}`, { method: 'PATCH', body: { dismiss_pin_request: true } })
ok('dismiss 200', r.status === 200, r)
d = await dump()
ok('dismiss clears', !d.global_settings.some((g) => g.key === 'pin_reset_request:' + S.id))
ok('dismiss logged in history', d.shop_history.some((h) => h.shop_id === S.id && h.action === 'pin_request_dismissed'))

// --- not admin
const sv = cookie; cookie = ''
ok('dismiss without admin → 401', (await admin(`/api/admin/shops/${S.id}`, { method: 'PATCH', body: { dismiss_pin_request: true } })).status === 401)
cookie = sv

// --- archived café: answer is the same, nothing written
const A = await mk('Archived Forgot ' + tag)
await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'archive' } })
const n0 = (await dump()).support_messages.length
r = await forgot(A.code)
ok('archived → 200 + ref', r.status === 200 && !!r.json.ref)
await sleep(500)
d = await dump()
ok('archived writes nothing', d.support_messages.length === n0 && !d.global_settings.some((g) => g.key === 'pin_reset_request:' + A.id))

// --- bad input
ok('empty code → 400', (await forgot('')).status === 400)

// --- rate limit: 5 per IP per hour
const ip = rip()
const codes = []
for (let i = 0; i < 6; i++) codes.push((await forgot('rate-' + i + tag, ip)).status)
ok('6th request from same IP → 429', codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, codes)

// --- delete removes it
await forgot(S.code); await sleep(500)
await admin(`/api/admin/shops/${S.id}/archive`, { method: 'POST', body: { action: 'archive' } })
r = await admin(`/api/admin/shops/${S.id}`, { method: 'DELETE', body: { confirm: S.code } })
d = await dump()
ok('delete removes pin request', r.status === 200 && !d.global_settings.some((g) => g.key.includes(S.id)), r)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
