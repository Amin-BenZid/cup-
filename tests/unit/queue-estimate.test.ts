import { estimateQueue, DEFAULT_PREP_S } from '../../src/lib/queue-estimate.ts'
let f = 0
const ok = (n: string, c: boolean, x: unknown = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); if (!c) f++ }
const NOW = Date.parse('2026-10-29T12:00:00Z')
const iso = (t: number) => new Date(t).toISOString()
const MIN = 60_000
// n orders, each `prep` min, finished every `gap` min, the newest `endAgo` min ago
const hist = (n: number, prep: number, gap: number, endAgo = 1) =>
  Array.from({ length: n }, (_, i) => { const r = NOW - (endAgo + i * gap) * MIN; return { created_at: iso(r - prep * MIN), ready_at: iso(r) } })
const secs = (a: string) => Math.round((Date.parse(a) - NOW) / 1000)

let e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: [] })
ok('new shop: default prep', e.typical_s === DEFAULT_PREP_S && secs(e.eta_at) === DEFAULT_PREP_S, e)
ok('new shop: low confidence', e.confidence === 'low' && e.samples === 0, e)

const busy = hist(20, 4, 2)
e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: busy })
ok('typical prep from history (4 min)', e.typical_s === 240, e)
ok('next in line: ready after one prep', secs(e.eta_at) === 240, e)
ok('20 samples: high confidence', e.confidence === 'high' && e.samples === 20, e)
ok('range brackets the estimate', Date.parse(e.eta_low_at) <= Date.parse(e.eta_at) && Date.parse(e.eta_at) <= Date.parse(e.eta_high_at), e)

e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 5, history: busy })
ok('5 ahead: uses throughput (5 × 2 min)', secs(e.eta_at) === 600, e)
ok('ahead echoed', e.ahead === 5)

e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 1, history: busy })
ok('1 ahead in parallel shop: own prep still the floor', secs(e.eta_at) === 240, e)

e = estimateQueue({ now: NOW, createdAt: iso(NOW - 3 * MIN), ahead: 0, history: busy })
ok('time already waited is counted', secs(e.eta_at) === 60, e)

e = estimateQueue({ now: NOW, createdAt: iso(NOW - 10 * MIN), ahead: 0, history: busy })
ok('overdue order: estimate is in the past (page shows "any moment")', secs(e.eta_at) < 0, e)

const withOutliers = [...busy, ...Array.from({ length: 3 }, (_, i) => ({ created_at: iso(NOW - (200 + i) * MIN), ready_at: iso(NOW - (30 + i) * MIN) })), { created_at: iso(NOW - 5 * MIN), ready_at: iso(NOW - 5 * MIN + 2000) }]
e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: withOutliers })
ok('forgotten (>90 min) and mis-tap (<15 s) orders ignored', e.typical_s === 240 && e.samples === 20, e)

const quiet = hist(6, 3, 60)
e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 4, history: quiet })
ok('quiet gaps (> 20 min) are not throughput', secs(e.eta_at) === Math.round(4 * 180 * 0.6), e)

const mixed = [...hist(6, 3, 5, 1), ...hist(30, 10, 2, 60 * 24)]
e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: mixed })
ok('last 2 h preferred over older days', e.typical_s === 180 && e.samples === 6, e)
ok('6 samples: medium confidence', e.confidence === 'medium', e)

e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: hist(2, 10, 3) })
ok('2 samples nudge the default', e.typical_s > DEFAULT_PREP_S && e.typical_s < 600 && e.confidence === 'low', e)

e = estimateQueue({ now: NOW, createdAt: iso(NOW), ahead: 0, history: [{ created_at: 'bad', ready_at: 'x' }, { created_at: iso(NOW), ready_at: iso(NOW + 3600_000) }] })
ok('bad and future rows ignored', e.samples === 0, e)

console.log(f ? `${f} FAILED` : 'ALL PASS')
process.exit(f ? 1 : 0)
