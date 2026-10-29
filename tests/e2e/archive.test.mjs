// Archive → restore → archive → delete-forever, against next start + mockpg.
const B = 'http://localhost:3100', PG = 'http://127.0.0.1:54321'
let fails = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) fails++ }
const json = (r) => r.json().catch(() => ({}))
const pg = (path, init = {}) => fetch(PG + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
const dump = async () => (await fetch(PG + '/__dump')).json()

// --- admin session
let cookie = ''
async function admin(path, { method = 'GET', body } = {}) {
  const h = { 'x-forwarded-for': '9.9.9.' + Math.floor(Math.random() * 200), origin: B }
  if (body !== undefined) h['content-type'] = 'application/json'
  if (cookie) h.cookie = cookie
  const r = await fetch(B + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const set = r.headers.get('set-cookie'); const m = /admin_session=([^;]*)/.exec(set || '')
  if (m) cookie = `admin_session=${m[1]}`
  return { status: r.status, json: await json(r) }
}
let r = await admin('/api/admin/login', { method: 'POST', body: { password: 'test-password-123' } })
ok('admin login', r.status === 200, r)

// --- two real shops via signup (so PINs are hashed properly)
async function mk(name) {
  const res = await fetch(B + '/api/shops', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ name, pin: '112233' }) })
  const s = (await json(res)).shop
  await pg(`/rest/v1/shops?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) })
  return s
}
const tag = Math.random().toString(36).slice(2, 6)
const A = await mk('Target ' + tag), K = await mk('Keeper ' + tag)
ok('shops created', A?.id && K?.id)

// --- seed related data for both
const d0 = await dump()
const ord = (shop, n) => Array.from({ length: n }, (_, i) => ({ id: `${shop.id}-o${i}`, shop_id: shop.id, order_number: String(i + 1), status: 'done', created_at: new Date().toISOString() }))
const oA = ord(A, 450), oK = ord(K, 3) // 450 → several push-sub chunks of 200
const subs = [...oA, ...oK].map((o, i) => ({ id: 'ps' + i, order_id: o.id, endpoint: 'https://push/' + i }))
const rev = (s, os) => os.slice(0, 2).map((o, i) => ({ id: s.id + 'r' + i, order_id: o.id, shop_id: s.id, rating: 3 }))
await pg('/__seed', {
  method: 'POST',
  body: JSON.stringify({
    orders: [...d0.orders, ...oA, ...oK],
    push_subscriptions: subs,
    reviews: [...rev(A, oA), ...rev(K, oK)],
    support_messages: [{ id: 'm1', shop_id: A.id, message: 'hi', sender: 'shop' }, { id: 'm2', shop_id: K.id, message: 'yo', sender: 'shop' }],
    global_settings: [...d0.global_settings,
      { key: `admin_notify_throttle:support:${A.id}`, value: { at: 1 } },
      { key: `admin_notify_throttle:support:${K.id}`, value: { at: 1 } }],
    __storage: [`${A.id}/1.png`, `${A.id}/2.webp`, `${K.id}/1.png`],
  }),
})

// --- barista can log in before archive
const login = (code) => fetch(B + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '6.6.6.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ code, pin: '112233' }) })
let lr = await login(A.code)
ok('barista login works before archive', lr.status === 200, await json(lr))
const shopCookie = (lr.headers.get('set-cookie') || '').split(';')[0]
const listA = () => fetch(B + `/api/orders/list?shop_id=${A.id}`, { headers: { cookie: shopCookie } })
ok('barista session works before archive', (await listA()).status === 200)

// --- delete refused while not archived
r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: { confirm: A.code } })
ok('delete refused when not archived (409)', r.status === 409, r)
ok('nothing deleted', (await dump()).orders.filter((o) => o.shop_id === A.id).length === 450)

// --- archive
r = await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'archive' } })
ok('archive 200', r.status === 200 && r.json.archived === true, r)
let d = await dump()
ok('status disabled', d.shops.find((s) => s.id === A.id).status === 'disabled')
ok('archive record saved with previous status', d.global_settings.find((g) => g.key === 'shop_archive:' + A.id)?.value?.previous_status === 'active')
ok('history: archived', d.shop_history.some((h) => h.shop_id === A.id && h.action === 'archived'))
lr = await login(A.code)
ok('barista login blocked when archived', lr.status === 403)
const sess = await listA()
ok('existing barista session blocked', sess.status === 401 || sess.status === 403, sess.status)
r = await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'archive' } })
ok('archive again is idempotent', r.status === 200 && r.json.archived)
r = await admin(`/api/admin/shops/${A.id}`, { method: 'PATCH', body: { status: 'active' } })
ok('enable while archived refused (409)', r.status === 409, r)

// --- list
r = await admin('/api/admin/shops')
const la = r.json.shops.find((s) => s.id === A.id), lk = r.json.shops.find((s) => s.id === K.id)
ok('list marks archived', la?.archived === true && !!la.archived_at && lk?.archived === false)
ok('archived not counted in totals', r.json.globalStats.totalShops === r.json.shops.filter((s) => !s.archived).length)
r = await admin(`/api/admin/shops/${A.id}`)
ok('detail shows archived', r.json.shop.archived === true)

// --- restore → back to active
r = await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'restore' } })
ok('restore 200 → active', r.status === 200 && r.json.status === 'active', r)
d = await dump()
ok('archive record gone', !d.global_settings.some((g) => g.key === 'shop_archive:' + A.id))
lr = await login(A.code)
ok('barista login works after restore', lr.status === 200)

// --- archive again then delete
await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'archive' } })
r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: { confirm: 'wrong' } })
ok('wrong confirm → 400', r.status === 400)
r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: {} })
ok('missing confirm → 400', r.status === 400)
ok('still intact', (await dump()).orders.filter((o) => o.shop_id === A.id).length === 450)

// unauthenticated delete
const saved = cookie; cookie = ''
r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: { confirm: A.code } })
ok('delete without admin → 401', r.status === 401)
r = await admin(`/api/admin/shops/${A.id}/archive`, { method: 'POST', body: { action: 'restore' } })
ok('archive without admin → 401', r.status === 401)
cookie = saved

r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: { confirm: A.code } })
ok('delete 200', r.status === 200 && r.json.ok, r)
console.log('report', r.json.deleted)
d = await dump()
const st = await (await fetch(PG + '/__storage')).json()
ok('shop row gone', !d.shops.some((s) => s.id === A.id))
ok('orders gone', !d.orders.some((o) => o.shop_id === A.id))
ok('push subs gone (450)', !d.push_subscriptions.some((p) => p.order_id.startsWith(A.id)) && r.json.deleted.push_subscriptions === 450)
ok('reviews gone', !d.reviews.some((x) => x.shop_id === A.id))
ok('support msgs gone', !d.support_messages.some((x) => x.shop_id === A.id))
ok('history gone', !d.shop_history.some((x) => x.shop_id === A.id))
ok('settings gone', !d.global_settings.some((g) => g.key.includes(A.id)))
ok('logo files gone', !st.some((p) => p.startsWith(A.id + '/')) && r.json.deleted.logo_files === 2)
ok('audit logged', JSON.stringify(d.global_settings.find((g) => g.key === 'admin_audit')?.value ?? '').includes('shop_deleted'))

// --- bystander untouched
ok('keeper shop intact', d.shops.some((s) => s.id === K.id))
ok('keeper orders intact', d.orders.filter((o) => o.shop_id === K.id).length === 3)
ok('keeper push subs intact', d.push_subscriptions.filter((p) => p.order_id.startsWith(K.id)).length === 3)
ok('keeper reviews intact', d.reviews.filter((x) => x.shop_id === K.id).length === 2)
ok('keeper msg intact', d.support_messages.some((x) => x.shop_id === K.id))
ok('keeper history intact', d.shop_history.some((x) => x.shop_id === K.id))
ok('keeper settings intact', d.global_settings.some((g) => g.key === `admin_notify_throttle:support:${K.id}`))
ok('keeper logo intact', st.includes(`${K.id}/1.png`))
ok('other orders untouched', d.orders.length === d0.orders.length + 3)

r = await admin(`/api/admin/shops/${A.id}`, { method: 'DELETE', body: { confirm: A.code } })
ok('second delete → 404', r.status === 404)
lr = await login(A.code)
ok('deleted shop cannot log in', lr.status === 401 || lr.status === 404)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
