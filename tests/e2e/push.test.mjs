import crypto from 'node:crypto'
const BASE='http://localhost:3100'
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,c?'':x)
const H={'content-type':'application/json',origin:BASE,'x-forwarded-for':'5.5.5.5'}
let r=await fetch(BASE+'/api/admin/login',{method:'POST',headers:H,body:JSON.stringify({password:'test-password-123'})})
const cookie=/admin_session=[^;]*/.exec(r.headers.get('set-cookie'))[0]
const A={...H,cookie}
function sub(path){const e=crypto.createECDH('prime256v1');e.generateKeys();return{endpoint:`https://localhost:8443/${path}`,keys:{p256dh:e.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}}}
for (const [p,l] of [['live/1','iPhone'],['gone/2','Old phone']]) {
  r=await fetch(BASE+'/api/admin/push',{method:'POST',headers:A,body:JSON.stringify({subscription:sub(p),label:l})}); ok('register '+l, r.status===200)
}
r=await fetch(BASE+'/api/admin/push/test',{method:'POST',headers:A}); let j=await r.json()
ok('test push sent to 1 live device', j.sent===1, JSON.stringify(j))
r=await fetch(BASE+'/api/admin/push',{headers:A}); j=await r.json()
ok('410 device pruned', j.devices.length===1 && j.devices[0].label==='iPhone', JSON.stringify(j.devices.map(d=>d.label)))
ok('last_sent_at recorded', !!j.devices[0].last_sent_at)
// signup → notification
r=await fetch(BASE+'/api/shops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Brew Lab',pin:'654321'})}); ok('signup 200', r.status===200)
await new Promise(r=>setTimeout(r,1500))
let log=await (await fetch('https://localhost:8443/__log')).json()
ok('signup produced a push to the live device', log.filter(x=>x.url==='/live/1').length>=2, JSON.stringify(log))
ok('pushes are encrypted aes128gcm + VAPID auth', log.every(x=>x.enc==='aes128gcm' && x.auth.startsWith('vapid')), JSON.stringify(log[0]))
// disable signup notifications → no push
await fetch(BASE+'/api/admin/settings',{method:'PATCH',headers:A,body:JSON.stringify({notify:{signup:false}})})
const before=log.length
await fetch(BASE+'/api/shops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Quiet Café',pin:'111111'})})
await new Promise(r=>setTimeout(r,1500))
log=await (await fetch('https://localhost:8443/__log')).json()
ok('signup pref off → no push', log.length===before, `${before} -> ${log.length}`)
