const BASE='http://localhost:3100', PG='http://127.0.0.1:54321'
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,c?'':x)
const j=(r)=>r.json()
// 1. signup + activate + barista login
let r=await fetch(BASE+'/api/shops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Live Café',pin:'246810'})})
const shop=(await j(r)).shop
await fetch(`${PG}/rest/v1/shops?id=eq.${shop.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'active'})})
r=await fetch(BASE+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:shop.code,pin:'246810'})})
ok('barista login',r.status===200, r.status)
const cookie=/shop_session=[^;]*/.exec(r.headers.get('set-cookie'))[0]
// 2. an order (insert directly: the mock has no create_order RPC)
r=await fetch(`${PG}/rest/v1/orders`,{method:'POST',headers:{'content-type':'application/json',prefer:'return=representation'},body:JSON.stringify({shop_id:shop.id,order_number:'12',status:'preparing',customer_connected:false})})
const order=(await j(r))[0]
// 3. topics handed out
r=await fetch(`${BASE}/api/orders/list?shop_id=${shop.id}`,{headers:{cookie}}); const list=await j(r)
ok('dashboard gets its topic', /^ords-[0-9a-f]{24}$/.test(list.topic), JSON.stringify(list))
r=await fetch(`${BASE}/api/o/${order.id}`); const pub=await j(r)
ok('customer gets its topic', /^ord-[0-9a-f]{24}$/.test(pub.topic), JSON.stringify(pub))
ok('topic leaks no ids', !pub.topic.includes(order.id) && !list.topic.includes(shop.id))
const html=await (await fetch(`${BASE}/o/${order.id}`)).text()
ok('server-rendered page carries the topic', html.includes(pub.topic))
const bc=async()=> (await j(await fetch(PG+'/__broadcasts')))
const topicsSent=async()=> (await bc()).flatMap(b=>b.body.messages.map(m=>m.topic))
// 4. customer scans → dashboard pinged once
await fetch(`${BASE}/api/orders/${order.id}/connect`,{method:'POST'}); await fetch(`${BASE}/api/orders/${order.id}/connect`,{method:'POST'})
await new Promise(r=>setTimeout(r,400))
let t=await topicsSent()
ok('scan pings the dashboard exactly once', t.filter(x=>x===list.topic).length===1, JSON.stringify(t))
// 5. mark ready → customer + dashboard pinged
r=await fetch(`${BASE}/api/orders/${order.id}`,{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify({status:'ready'})})
ok('mark ready 200', r.status===200)
await new Promise(r=>setTimeout(r,400))
t=await topicsSent()
ok('ready pings the customer page', t.includes(pub.topic), JSON.stringify(t))
ok('ready pings the dashboard', t.filter(x=>x===list.topic).length===2)
const all=await bc()
ok('payload carries no personal data', all.every(b=>b.body.messages.every(m=>JSON.stringify(m.payload).length<40 && !JSON.stringify(m.payload).includes(order.id))), JSON.stringify(all.at(-1)))
ok('broadcast authenticated with service key', all.every(b=>b.auth==='key'))
// 6. other shop can't fetch list
r=await fetch(`${BASE}/api/orders/list?shop_id=someone-else`,{headers:{cookie}}); ok('other shop list → 403', r.status===403, r.status)
