// Customer queue: last served order, orders ahead, estimate, live refresh.
const BASE = 'http://localhost:3100', PG = 'http://127.0.0.1:54321'
let f = 0
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : typeof x === 'string' ? x : JSON.stringify(x)); if (!c) f++ }
const j = (r) => r.json()
const MIN = 60_000
const iso = (t) => new Date(t).toISOString()
const now = Date.now()

async function makeShop(name) {
  let r = await fetch(BASE + '/api/shops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pin: '246810' }) })
  const shop = (await j(r)).shop
  await fetch(`${PG}/rest/v1/shops?id=eq.${shop.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
  r = await fetch(BASE + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: shop.code, pin: '246810' }) })
  const cookie = /shop_session=[^;]*/.exec(r.headers.get('set-cookie') || '')?.[0]
  return { shop, cookie }
}
async function insert(rows) {
  const r = await fetch(`${PG}/rest/v1/orders`, { method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=representation' }, body: JSON.stringify(rows) })
  return j(r)
}

const { shop, cookie } = await makeShop('Queue Shop')
const other = await makeShop('Other Queue Shop')
ok('barista login', !!cookie)

// History: 20 orders today, 4 min each, one finished every 2 min; newest = #120.
const hist = Array.from({ length: 20 }, (_, i) => {
  const ready = now - (1 + i * 2) * MIN
  return { shop_id: shop.id, order_number: String(120 - i), status: 'done', customer_phone: '+21698000000', created_at: iso(ready - 4 * MIN), ready_at: iso(ready) }
})
await insert(hist)
// Waiting: a forgotten one from 3 h ago, two real ones ahead, then mine.
const [stale, a1, a2, mine] = await insert([
  { shop_id: shop.id, order_number: '7', status: 'preparing', customer_connected: false, created_at: iso(now - 180 * MIN) },
  { shop_id: shop.id, order_number: '121', status: 'preparing', customer_connected: false, created_at: iso(now - 3 * MIN) },
  { shop_id: shop.id, order_number: '122', status: 'preparing', customer_connected: false, created_at: iso(now - 2 * MIN) },
  { shop_id: shop.id, order_number: '123', status: 'preparing', customer_connected: true, created_at: iso(now - 1 * MIN) },
])
// Another shop's busy queue must not count.
await insert([{ shop_id: other.shop.id, order_number: '1', status: 'preparing', customer_connected: false, created_at: iso(now - 5 * MIN) }])

let r = await fetch(`${BASE}/api/o/${mine.id}`)
let pub = await j(r)
let q = pub.queue
ok('queue returned while preparing', r.status === 200 && !!q, pub)
ok('2 ahead (forgotten + other shop ignored)', q?.ahead === 2, q)
ok('last served is #120', q?.last_served?.number === '120', q)
ok('typical prep 4 min, high confidence', q?.typical_s === 240 && q?.confidence === 'high' && q?.samples === 20, q)
const left = (Date.parse(q.eta_at) - Date.parse(q.now)) / 1000
ok('estimate: 2 ahead × 2 min ≈ 4 min', left >= 230 && left <= 250, { left, q })
ok('range brackets estimate', Date.parse(q.eta_low_at) <= Date.parse(q.eta_at) && Date.parse(q.eta_at) <= Date.parse(q.eta_high_at), q)
ok('queue topic handed out', /^q-[0-9a-f]{24}$/.test(q.topic), q)
const qs = JSON.stringify(q)
ok('queue leaks no ids or phones', ![shop.id, a1.id, a2.id, stale.id, other.shop.id, '+216'].some((x) => qs.includes(x)), qs)
ok('order id not changed by queue', pub.order.id === mine.id && !('shop_id' in pub.order), pub.order)

r = await fetch(`${BASE}/api/o/${a1.id}`); q = (await j(r)).queue
ok('first in line: 0 ahead', q?.ahead === 0, q)
ok('same shop, same topic', q?.topic === pub.queue.topic)
r = await fetch(`${BASE}/api/o/${(await insert([{ shop_id: other.shop.id, order_number: '2', status: 'preparing', customer_connected: false, created_at: iso(now) }]))[0].id}`)
const oq = (await j(r)).queue
ok('other shop: own queue, own topic, no history yet', oq?.ahead === 1 && oq?.last_served === null && oq?.confidence === 'low' && oq?.topic !== pub.queue.topic, oq)

const html = await (await fetch(`${BASE}/o/${mine.id}`)).text()
ok('server-rendered page shows the queue card', html.includes('data-testid="queue-card"'))
ok('server-rendered page shows last served', html.includes('#<!-- -->120') || html.includes('#120'))

// Barista marks #121 ready → queue topic pinged, my position moves.
r = await fetch(`${BASE}/api/orders/${a1.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ status: 'ready' }) })
ok('mark ready 200', r.status === 200, r.status)
await new Promise((res) => setTimeout(res, 500))
const topics = (await j(await fetch(PG + '/__broadcasts'))).flatMap((b) => b.body.messages.map((m) => m.topic))
ok('ready pings the queue topic', topics.includes(pub.queue.topic), topics)
r = await fetch(`${BASE}/api/o/${mine.id}`); q = (await j(r)).queue
ok('now 1 ahead', q?.ahead === 1, q)
ok('last served is now #121', q?.last_served?.number === '121', q)

r = await fetch(`${BASE}/api/o/${a1.id}`); pub = await j(r)
ok('ready order: no queue', pub.order.status === 'ready' && pub.queue === null, pub)

console.log(f ? `${f} FAILED` : 'ALL PASS')
process.exit(f ? 1 : 0)
