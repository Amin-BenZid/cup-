const https=require('https'),fs=require('fs')
const log=[]
const dir=process.env.PUSH_CERT_DIR||'.'
https.createServer({key:fs.readFileSync(dir+'/key.pem'),cert:fs.readFileSync(dir+'/cert.pem')},(req,res)=>{
  let n=0; const parts=[]; req.on('data',c=>{n+=c.length;parts.push(c)}); req.on('end',()=>{
    if(req.url==='/__log'){res.writeHead(200);return res.end(JSON.stringify(log))}
    log.push({url:req.url,ttl:req.headers.ttl,enc:req.headers['content-encoding'],auth:(req.headers.authorization||'').slice(0,12),bytes:n,body:Buffer.concat(parts).toString('base64')})
    res.writeHead(req.url.startsWith('/gone')?410:201); res.end()
  })
}).listen(8443,()=>console.log('push on 8443'))
