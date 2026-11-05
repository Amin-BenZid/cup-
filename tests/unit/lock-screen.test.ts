import { lockScreenTitle } from '../../src/lib/lock-screen.ts'
import { translations } from '../../src/lib/i18n/translations.ts'
let f = 0
const ok = (n: string, got: unknown, want: unknown) => { const g = JSON.stringify(got), w = JSON.stringify(want); console.log(g === w ? 'PASS' : 'FAIL', n, g === w ? '' : `got ${g} want ${w}`); if (g !== w) f++ }
const tFor = (loc: 'fr' | 'ar' | 'en') => (k: string, v: Record<string, string | number> = {}) =>
  ((translations[loc] as Record<string, string>)[k] ?? k).replace(/%(\w+)/g, (_, x) => String(v[x] ?? `%${x}`))

const en = tFor('en'), fr = tFor('fr'), ar = tFor('ar')
ok('en preparing, no estimate', lockScreenTitle(en, 'preparing', '42', null), 'Order 42 · being prepared')
ok('en preparing with estimate', lockScreenTitle(en, 'preparing', '42', 4), 'Order 42 · ready in ~4 min')
ok('en estimate passed → plain preparing', lockScreenTitle(en, 'preparing', '42', 0), 'Order 42 · being prepared')
ok('en negative estimate → plain preparing', lockScreenTitle(en, 'preparing', '42', -3), 'Order 42 · being prepared')
ok('en ready', lockScreenTitle(en, 'ready', '42', 4), 'Order 42 · ready!')
ok('fr ready', lockScreenTitle(fr, 'ready', '7', null), 'Commande 7 · prête !')
ok('fr estimate', lockScreenTitle(fr, 'preparing', '7', 12), 'Commande 7 · prête dans ~12 min')
ok('ar ready', lockScreenTitle(ar, 'ready', '522', null), 'طلب 522 · جاهز!')
ok('ar preparing', lockScreenTitle(ar, 'preparing', '222', null), 'طلب 222 · قيد التحضير')
for (const loc of ['fr', 'ar', 'en'] as const) {
  const d = translations[loc] as Record<string, string>
  ok(`${loc}: all lock keys present`, ['lock.preparing', 'lock.eta', 'lock.ready'].every((k) => typeof d[k] === 'string' && d[k].includes('%n')), true)
}
console.log(f ? `${f} FAILED` : 'ALL PASS')
process.exit(f ? 1 : 0)
