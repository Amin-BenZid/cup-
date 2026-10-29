#!/usr/bin/env node
/**
 * Beep CI: build, typecheck, lint, then every end-to-end suite against a fake
 * Supabase (tests/e2e/mock-supabase.js) and a fake push service. Never touches
 * a real database. Writes a report for humans (and for Claude) to
 * tests/ci/out/ci-report.md and exits non-zero if anything blocking failed.
 *
 *   npm run test:ci                    everything
 *   npm run test:ci -- --only=archive  one suite (comma list allowed)
 *   npm run test:ci -- --no-build      reuse the last build
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'tests', 'ci', 'out')
const APP = 'http://localhost:3100'
const DB = 'http://127.0.0.1:54321'
const args = process.argv.slice(2)
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean)
const noBuild = args.includes('--no-build')
const PY = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

/* ------------------------------------------------------------- test env */

// Throwaway secrets for this run only.
const require = createRequire(path.join(ROOT, 'package.json'))
const vapid = require('web-push').generateVAPIDKeys()
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beep-ci-'))
const ssl = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
  '-keyout', path.join(certDir, 'key.pem'), '-out', path.join(certDir, 'cert.pem'),
  '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
], { encoding: 'utf8' })
const havePushServer = ssl.status === 0

const ENV = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: DB,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'ci-service-role-key',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: 'mailto:ci@example.com',
  ADMIN_PASSWORD: 'test-password-123',
  ADMIN_SECRET: 'ci-admin-secret-0123456789abcdef0123456789',
  SHOP_SESSION_SECRET: 'ci-shop-secret-0123456789abcdef0123456789',
  PIN_PEPPER: 'ci-pepper-0123456789abcdef0123456789abcdef',
  CRON_SECRET: 'ci-cron-secret',
  SUPPORT_EMAIL: '',
  ADMIN_2FA_RESET: '',
  NODE_EXTRA_CA_CERTS: havePushServer ? path.join(certDir, 'cert.pem') : '',
  PUSH_CERT_DIR: certDir,
}

/* ---------------------------------------------------------------- helpers */

const results = []
const procs = []
const t0 = Date.now()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...m) => console.log('[ci]', ...m)

function run(cmd, cmdArgs, { env = ENV, timeoutMs = 600_000, logName } = {}) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env, shell: process.platform === 'win32' })
    let out = ''
    const take = (d) => {
      const s = d.toString()
      out += s
      process.stdout.write(s)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    const timer = setTimeout(() => {
      out += `\n[ci] TIMEOUT after ${Math.round(timeoutMs / 1000)} s, stopped.\n`
      child.kill('SIGKILL')
    }, timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      if (logName) fs.writeFileSync(path.join(OUT, 'logs', `${logName}.log`), out)
      resolve({ code: code ?? 1, out, ms: Date.now() - started, timedOut: out.includes('[ci] TIMEOUT') })
    })
  })
}

function startBackground(name, cmd, cmdArgs, env = ENV) {
  const file = fs.openSync(path.join(OUT, 'logs', `${name}.log`), 'a')
  // Own process group, so stopping it also stops what it started (npx → next-server).
  const child = spawn(cmd, cmdArgs, {
    cwd: ROOT,
    env,
    stdio: ['ignore', file, file],
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  })
  procs.push(child)
  return child
}

function stopAll() {
  for (const p of procs) {
    if (!p.pid || p.exitCode !== null) continue
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'])
      else process.kill(-p.pid, 'SIGKILL')
    } catch {}
  }
  procs.length = 0
}

async function portBusy(port) {
  const net = await import('node:net')
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(true))
    srv.once('listening', () => srv.close(() => resolve(false)))
    srv.listen(port, '0.0.0.0')
  })
}

async function waitFor(url, ms, init) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const r = await fetch(url, init)
      if (r.status < 500) return true
    } catch {}
    await sleep(500)
  }
  return false
}

function parse(out) {
  const lines = out.split('\n')
  const passed = lines.filter((l) => /^PASS\b/.test(l)).length
  const failed = lines.filter((l) => /^FAIL\b/.test(l))
  const errors = lines.filter((l) => /Error|Traceback|TIMEOUT|exception/i.test(l) && !/^PASS/.test(l)).slice(0, 12)
  return { passed, failed, errors }
}

function serverLogSince(offset) {
  try {
    const s = fs.readFileSync(path.join(OUT, 'logs', 'app-server.log'), 'utf8')
    return s.slice(offset)
  } catch {
    return ''
  }
}
const serverLogSize = () => {
  try {
    return fs.statSync(path.join(OUT, 'logs', 'app-server.log')).size
  } catch {
    return 0
  }
}

async function resetDb() {
  await fetch(`${DB}/__reset`, { method: 'POST' })
  // Data every suite expects.
  await fetch(`${DB}/rest/v1/global_settings?on_conflict=key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'support_contact', value: { email: 'support@beep.test', phone: '+21650000000' } }),
  })
}

function record(r) {
  results.push(r)
  const icon = r.status === 'pass' ? 'PASS' : r.status === 'warn' ? 'WARN' : r.status === 'skip' ? 'SKIP' : 'FAIL'
  log(`${icon} ${r.title} (${(r.ms / 1000).toFixed(1)} s)`)
}

/* ------------------------------------------------------------------ steps */

const SUITES = [
  { id: 'unit-install', title: 'Unit · Add to Home Screen platform detection', cmd: 'node', args: ['tests/unit/install-platform.test.ts'], needsApp: false },
  { id: 'auth', title: 'Admin security (login, 2FA, sessions, origin checks)', cmd: 'node', args: ['tests/e2e/auth.test.mjs'] },
  { id: 'code', title: 'Shop code login (spaces, caps)', cmd: 'node', args: ['tests/e2e/code.test.mjs'] },
  { id: 'archive', title: 'Archive / restore / delete forever', cmd: 'node', args: ['tests/e2e/archive.test.mjs'] },
  { id: 'forgot', title: 'Forgot PIN flow', cmd: 'node', args: ['tests/e2e/forgot.test.mjs'] },
  { id: 'phone', title: 'Shop phone number + forgot-PIN callback', cmd: 'node', args: ['tests/e2e/phone.test.mjs'] },
  { id: 'live', title: 'Live orders (realtime)', cmd: 'node', args: ['tests/e2e/live.test.mjs'] },
  { id: 'push', title: 'Admin push notifications', cmd: 'node', args: ['tests/e2e/push.test.mjs'], needsPush: true },
  { id: 'i18n', title: 'Translations: error codes + customer push language', cmd: 'node', args: ['tests/e2e/i18n.test.mjs'], needsPush: true },
  { id: 'ui-states', title: 'UI · shop states (archived, paused, deleted, expired)', cmd: PY, args: ['tests/ui/shop_states.py'], timeoutMs: 420_000, ui: true },
  { id: 'ui-install', title: 'UI · Add to Home Screen (iPhone, Android, in-app)', cmd: PY, args: ['tests/ui/install.py'], timeoutMs: 300_000, ui: true },
  { id: 'ui-offline', title: 'UI · offline page', cmd: PY, args: ['tests/ui/offline.py'], timeoutMs: 120_000, ui: true },
]

async function main() {
  log(`root ${ROOT}`)
  const selected = SUITES.filter((s) => !only.length || only.includes(s.id))

  // 1. Build
  if (!noBuild) {
    const b = await run('npx', ['next', 'build'], { logName: 'build', timeoutMs: 900_000 })
    const ok = b.code === 0
    record({ id: 'build', title: 'Build (next build)', status: ok ? 'pass' : 'fail', blocking: true, ms: b.ms, passed: ok ? 1 : 0, failed: ok ? [] : ['next build failed'], errors: parse(b.out).errors, tail: b.out.split('\n').slice(-40).join('\n') })
    if (!ok) return finish()
  }

  // 2. Typecheck (after the build, so generated route types are fresh)
  {
    const tc = await run('npx', ['tsc', '--noEmit', '-p', '.'], { logName: 'typecheck', timeoutMs: 300_000 })
    const errs = tc.out.split('\n').filter((l) => /error TS\d+/.test(l))
    record({ id: 'typecheck', title: 'Typecheck (tsc)', status: tc.code === 0 ? 'pass' : 'fail', blocking: true, ms: tc.ms, passed: tc.code === 0 ? 1 : 0, failed: errs.slice(0, 30), errors: [], tail: errs.slice(0, 40).join('\n') })
  }

  // 3. Lint: reported, not blocking yet (the codebase still has known findings).
  {
    const jsonFile = path.join(OUT, 'logs', 'lint.json')
    const ln = await run('npx', ['eslint', 'src', '--format', 'json', '--output-file', jsonFile], { logName: 'lint', timeoutMs: 300_000 })
    let files = null
    try {
      files = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
    } catch {}
    if (!files) {
      // ESLint itself crashed: never report that as green.
      record({ id: 'lint', title: 'Lint (eslint) could not run', status: 'warn', blocking: false, ms: ln.ms, passed: 0, failed: ln.out.split('\n').filter(Boolean).slice(0, 5), errors: [], tail: '' })
    } else {
      const items = files.flatMap((f) => f.messages.map((m) => ({ ...m, file: path.relative(ROOT, f.filePath) })))
      const errs = items.filter((m) => m.severity === 2)
      const warns = items.filter((m) => m.severity === 1)
      const fmt = (m) => `${m.file}:${m.line}  ${m.ruleId ?? ''}  ${m.message.split('\n')[0].slice(0, 120)}`
      record({ id: 'lint', title: `Lint (eslint) · ${errs.length} errors, ${warns.length} warnings`, status: errs.length ? 'warn' : 'pass', blocking: false, ms: ln.ms, passed: errs.length ? 0 : 1, failed: errs.map(fmt), errors: [], tail: '' })
    }
  }

  // 4. Services (refuse to run against something already listening)
  const busy = []
  for (const port of [3100, 54321, 8443]) if (await portBusy(port)) busy.push(port)
  if (busy.length) {
    record({ id: 'services', title: 'Free ports', status: 'fail', blocking: true, ms: 0, passed: 0, failed: [`port ${busy.join(', ')} already in use: stop the app/tests using it and run again`], errors: [], tail: '' })
    return finish()
  }
  startBackground('mock-supabase', 'node', ['tests/e2e/mock-supabase.js'])
  if (havePushServer) startBackground('push-server', 'node', ['tests/e2e/push-server.js'])
  if (!(await waitFor(`${DB}/__dump`, 15_000))) {
    record({ id: 'services', title: 'Start fake Supabase', status: 'fail', blocking: true, ms: 0, passed: 0, failed: ['mock Supabase did not start'], errors: [], tail: '' })
    return finish()
  }
  startBackground('app-server', 'npx', ['next', 'start', '-p', '3100'])
  if (!(await waitFor(`${APP}/`, 60_000))) {
    record({ id: 'services', title: 'Start the app', status: 'fail', blocking: true, ms: 0, passed: 0, failed: ['next start did not answer on :3100'], errors: [], tail: serverLogSince(0).slice(-3000) })
    return finish()
  }

  // 5. Suites, each on a fresh database
  for (const s of selected) {
    if (s.needsPush && !havePushServer) {
      record({ id: s.id, title: s.title, status: 'skip', blocking: false, ms: 0, passed: 0, failed: [], errors: ['openssl missing: no fake push server'], tail: '' })
      continue
    }
    await resetDb()
    const offset = serverLogSize()
    const shots = path.join(OUT, 'screenshots', s.id)
    const r = await run(s.cmd, s.args, { env: { ...ENV, SHOTS_DIR: shots }, timeoutMs: s.timeoutMs ?? 180_000, logName: s.id })
    const p = parse(r.out)
    const crashed = p.passed + p.failed.length === 0 || r.timedOut
    const failed = p.failed.length > 0 || crashed || (r.code !== 0 && p.failed.length === 0 && /Error|Traceback/.test(r.out))
    const serverTail = serverLogSince(offset)
    record({
      id: s.id,
      title: s.title,
      status: failed ? 'fail' : 'pass',
      blocking: true,
      ms: r.ms,
      passed: p.passed,
      failed: crashed && !p.failed.length ? [r.timedOut ? 'suite timed out' : 'suite crashed before reporting'] : p.failed,
      errors: p.errors,
      tail: r.out.split('\n').slice(-30).join('\n'),
      server: serverTail.split('\n').filter((l) => /error|warn|fail|unhandled|\[/i.test(l)).slice(-25).join('\n'),
      screenshots: fs.existsSync(shots) ? fs.readdirSync(shots).map((f) => `screenshots/${s.id}/${f}`) : [],
    })
  }
  return finish()
}

/* ----------------------------------------------------------------- report */

function finish() {
  stopAll()
  const blockingFail = results.some((r) => r.blocking && r.status === 'fail')
  const sha = process.env.GITHUB_SHA ?? spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim()
  const msg = spawnSync('git', ['log', '-1', '--format=%s', sha], { cwd: ROOT, encoding: 'utf8' }).stdout.trim()
  const icon = { pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️' }
  const total = results.reduce((a, r) => a + r.passed, 0)
  const totalFail = results.filter((r) => r.blocking).reduce((a, r) => a + r.failed.length, 0)

  const md = []
  md.push(`# Beep CI report — ${blockingFail ? '❌ FAILED, not deployed' : '✅ PASSED'}`)
  md.push('')
  md.push(`- **Commit:** \`${sha.slice(0, 7)}\` ${msg}`)
  md.push(`- **When:** ${new Date().toISOString()} · **Duration:** ${Math.round((Date.now() - t0) / 1000)} s`)
  md.push(`- **Checks:** ${total} passed, ${totalFail} failed`)
  if (process.env.GITHUB_RUN_ID) md.push(`- **Run:** ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`)
  md.push('')
  md.push('| | Step | Passed | Failed | Time |')
  md.push('|---|---|---:|---:|---:|')
  for (const r of results) md.push(`| ${icon[r.status]} | ${r.title}${r.blocking ? '' : ' *(not blocking)*'} | ${r.passed} | ${r.failed.length} | ${(r.ms / 1000).toFixed(1)} s |`)
  const bad = results.filter((r) => r.status === 'fail')
  if (bad.length) {
    md.push('')
    md.push('## What failed')
    for (const r of bad) {
      md.push('')
      md.push(`### ❌ ${r.title}`)
      md.push(`Re-run just this: \`npm run test:ci -- --only=${r.id}${['build', 'typecheck', 'services'].includes(r.id) ? '' : ' --no-build'}\``)
      if (r.failed.length) {
        md.push('')
        md.push('**Failed checks**')
        for (const f of r.failed.slice(0, 30)) md.push(`- ${f.replace(/^FAIL\s*/, '')}`)
      }
      if (r.errors?.length) {
        md.push('')
        md.push('**Errors**')
        md.push('```')
        md.push(r.errors.join('\n'))
        md.push('```')
      }
      if (r.server) {
        md.push('')
        md.push('**App server log during this step**')
        md.push('```')
        md.push(r.server)
        md.push('```')
      }
      if (r.tail) {
        md.push('')
        md.push('<details><summary>Last output lines</summary>')
        md.push('')
        md.push('```')
        md.push(r.tail)
        md.push('```')
        md.push('</details>')
      }
      if (r.screenshots?.length) md.push(`\nScreenshots: ${r.screenshots.map((s) => `\`${s}\``).join(', ')}`)
    }
  }
  const warns = results.filter((r) => r.status === 'warn')
  if (warns.length) {
    md.push('')
    md.push('## Warnings (not blocking)')
    for (const r of warns) {
      md.push(`- **${r.title}**`)
      for (const f of r.failed.slice(0, 10)) md.push(`  - \`${f.replace(ROOT + '/', '')}\``)
    }
  }
  md.push('')
  md.push('_Full logs and screenshots are in the run artifact `ci-report` (tests/ci/out/). Paste this report to Claude to debug._')

  const text = md.join('\n')
  fs.writeFileSync(path.join(OUT, 'ci-report.md'), text)
  fs.writeFileSync(path.join(OUT, 'ci-report.json'), JSON.stringify({ ok: !blockingFail, sha, results }, null, 2))
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
  console.log('\n' + text)
  fs.rmSync(certDir, { recursive: true, force: true })
  process.exit(blockingFail ? 1 : 0)
}

process.on('SIGINT', finish)
process.on('SIGTERM', finish)
main().catch((e) => {
  record({ id: 'runner', title: 'CI runner', status: 'fail', blocking: true, ms: 0, passed: 0, failed: [String(e?.message ?? e)], errors: [String(e?.stack ?? '')], tail: '' })
  finish()
})
