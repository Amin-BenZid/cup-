const B='http://localhost:3100', PG='http://127.0.0.1:54321'
const ok=(n,c,x='')=>{console.log(c?'PASS':'FAIL',n,c?'':x); if(!c) process.exitCode=1}
const name='My Coffee '+Math.random().toString(36).slice(2,5)
let r=await fetch(B+'/api/shops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,pin:'112233'})})
const shop=(await r.json()).shop; console.log('created code:', shop.code)
await fetch(`${PG}/rest/v1/shops?id=eq.${shop.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'active'})})
const spaced=shop.code.replace(/-/g,' ')
for (const typed of [shop.code, spaced, spaced.toUpperCase(), ' '+spaced+' ', spaced+' ', shop.code+'-', spaced.replace(' ','  ')]) {
  r=await fetch(B+'/api/auth',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'7.7.7.'+Math.floor(Math.random()*200)},body:JSON.stringify({code:typed,pin:'112233'})})
  ok(`login with ${JSON.stringify(typed)}`, r.status===200, r.status)
}
r=await fetch(B+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'no such shop',pin:'112233'})})
ok('unknown code still 401', r.status===401, r.status)
r=await fetch(B+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:spaced,pin:'999999'})})
ok('wrong PIN still 401', r.status===401, r.status)
