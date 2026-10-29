// In-memory stand-in for Supabase (PostgREST, Storage, Realtime) used only by
// the CI tests in tests/. Never talks to a real database.
const http = require('http')
const storage = new Set()
const db = { global_settings: [], shops: [], orders: [], support_messages: [], shop_history: [], reviews: [], client_errors: [] }

function getPath(row, col) {
  if (col.includes('->>')) {
    const [c, k] = col.split('->>')
    const v = row[c]?.[k]
    return v === undefined || v === null ? null : String(v)
  }
  return row[col]
}

function match(row, col, expr) {
  const neg = expr.startsWith('not.')
  if (neg) expr = expr.slice(4)
  const i = expr.indexOf('.')
  const op = expr.slice(0, i)
  const raw = expr.slice(i + 1)
  const v = getPath(row, col)
  let r
  switch (op) {
    case 'eq': r = String(v) === raw; break
    case 'neq': r = String(v) !== raw; break
    case 'lt': r = v !== null && String(v) < raw; break
    case 'lte': r = v !== null && String(v) <= raw; break
    case 'gt': r = v !== null && String(v) > raw; break
    case 'gte': r = v !== null && String(v) >= raw; break
    case 'like': {
      const re = new RegExp('^' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$')
      r = v !== null && re.test(String(v)); break
    }
    case 'is': r = raw === 'null' ? v === null || v === undefined : String(v) === raw; break
    case 'in': {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))
      r = v !== null && v !== undefined && list.includes(String(v)); break
    }
    default: throw new Error('mockpg: unsupported operator ' + op)
  }
  return neg ? !r : r
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const url = new URL(req.url, 'http://x')
    const table = url.pathname.replace('/rest/v1/', '')
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('[]')
    }
    if (url.pathname === '/__reset' && req.method === 'POST') {
      for (const k of Object.keys(db)) db[k] = []
      storage.clear(); global.bc = []; global.rm = []
      res.writeHead(200); return res.end('{}')
    }
    if (url.pathname === '/__seed' && req.method === 'POST') {
      const d = JSON.parse(body); for (const k of Object.keys(d)) db[k] = d[k]
      if (d.__storage) { storage.clear(); for (const p of d.__storage) storage.add(p) }
      res.writeHead(200); return res.end('{}')
    }
    if (url.pathname === '/__storage') { res.writeHead(200); return res.end(JSON.stringify([...storage])) }
    if (url.pathname === '/storage/v1/object/list/logos' && req.method === 'POST') {
      const b = JSON.parse(body || '{}'); const pre = (b.prefix || '').replace(/\/$/, '') + '/'
      const names = [...storage].filter((p) => p.startsWith(pre)).map((p) => p.slice(pre.length)).filter((n) => !n.includes('/'))
      const out = names.slice(b.offset || 0, (b.offset || 0) + (b.limit || 100)).map((name) => ({ name, id: 'x', metadata: {} }))
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out))
    }
    if (url.pathname === '/storage/v1/object/logos' && req.method === 'DELETE') {
      const b = JSON.parse(body || '{}'); const gone = []
      for (const p of b.prefixes || []) if (storage.delete(p)) gone.push({ name: p })
      ;(global.rm ??= []).push(b.prefixes)
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(gone))
    }
    if (url.pathname.startsWith('/storage/v1/object/logos/') && req.method === 'POST') {
      storage.add(decodeURIComponent(url.pathname.slice('/storage/v1/object/logos/'.length)))
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"Key":"ok"}')
    }
    if (url.pathname === '/__dump') { res.writeHead(200); return res.end(JSON.stringify(db)) }
    if (url.pathname === '/realtime/v1/api/broadcast') {
      const parsed = JSON.parse(body)
      ;(global.bc ??= []).push({ auth: req.headers.apikey ? 'key' : 'none', body: parsed })
      for (const m of parsed.messages) for (const c of sockets) if (c.topics.has('realtime:' + m.topic))
        c.ws.send(JSON.stringify([null, null, 'realtime:' + m.topic, 'broadcast', { type: 'broadcast', event: m.event, payload: m.payload }]))
      res.writeHead(202); return res.end('')
    }
    if (url.pathname === '/__sockets') { res.writeHead(200); return res.end(JSON.stringify(sockets.map((c) => [...c.topics]))) }
    if (url.pathname === '/__broadcasts') { res.writeHead(200); return res.end(JSON.stringify(global.bc ?? [])) }
    const rows = (db[table] ??= [])
    const filters = [...url.searchParams.entries()].filter(([k]) => !RESERVED.has(k))
    const sel = (r) => filters.every(([k, v]) => match(r, k, v))
    try { rows.forEach(sel) } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ message: e.message })) }
    const prefer = req.headers['prefer'] || ''
    const wantObj = (req.headers['accept'] || '').includes('vnd.pgrst.object')
    const send = (status, data, extra = {}) => {
      if (wantObj && Array.isArray(data)) {
        if (data.length !== 1) { res.writeHead(406, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ code: 'PGRST116', message: 'not one row' })) }
        data = data[0]
      }
      res.writeHead(status, { 'Content-Type': 'application/json', ...extra })
      res.end(req.method === 'HEAD' ? '' : JSON.stringify(data))
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      let out = rows.filter(sel)
      const lim = url.searchParams.get('limit'), off = Number(url.searchParams.get('offset') || 0)
      const total = out.length
      out = out.slice(off, lim ? off + Number(lim) : undefined)
      return send(200, out, prefer.includes('count=exact') ? { 'Content-Range': `0-${Math.max(0, out.length - 1)}/${total}` } : {})
    }
    const payload = body ? JSON.parse(body) : null
    if (req.method === 'POST') {
      const items = Array.isArray(payload) ? payload : [payload]
      const conflict = url.searchParams.get('on_conflict')
      const out = []
      for (const it of items) {
        const existing = conflict && prefer.includes('merge-duplicates') ? rows.find((r) => r[conflict] === it[conflict]) : null
        if (existing) { Object.assign(existing, it); out.push(existing) }
        else { const row = { id: String(rows.length + 1) + '-' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString(), ...it }; rows.push(row); out.push(row) }
      }
      return send(201, prefer.includes('return=representation') ? out : [])
    }
    if (req.method === 'PATCH') {
      const hit = rows.filter(sel); hit.forEach((r) => Object.assign(r, payload))
      return send(200, prefer.includes('return=representation') ? hit : [])
    }
    if (req.method === 'DELETE') {
      const keep = rows.filter((r) => !sel(r)); const gone = rows.length - keep.length
      db[table] = keep
      return send(200, [], { 'X-Deleted': String(gone), 'Content-Range': `*/${gone}` })
    }
    send(405, { message: 'nope' })
  })
})
// Minimal Phoenix (vsn 2.0.0) stand-in for Supabase Realtime broadcast.
const { WebSocketServer } = require('ws')
const sockets = []
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, sock, head) => {
  if (req.url.split('?')[0] !== '/realtime/v1/websocket') return sock.destroy()
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req))
})
wss.on('connection', (ws) => {
  const c = { ws, topics: new Set() }; sockets.push(c)
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()) } catch { return }
    const [joinRef, ref, topic, event] = m
    if (event === 'phx_join') { c.topics.add(topic); ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }])) }
    else if (event === 'phx_leave') { c.topics.delete(topic); ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }])) }
    else ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
  })
  ws.on('close', () => sockets.splice(sockets.indexOf(c), 1))
})
server.listen(54321, () => console.log('mockpg on 54321'))
