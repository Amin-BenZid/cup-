# Tests

One command runs everything: build, typecheck, lint, and every end-to-end
suite against a **fake** Supabase (`tests/e2e/mock-supabase.js`) and a fake
push service. No real database or secret is ever used.

```bash
npm run test:ci                         # everything (~4 min)
npm run test:ci -- --only=archive       # one suite (comma list allowed)
npm run test:ci -- --only=ui-states --no-build   # reuse the last build
```

The report is written to `tests/ci/out/ci-report.md` (plus logs and
screenshots in the same folder). In GitHub Actions it is shown on the run
page and attached as the `ci-report` artifact. Paste it to Claude to debug.

| Suite id | What it covers |
|---|---|
| `unit-install` | Add to Home Screen: phone/browser detection (14 user agents) |
| `unit-queue` | Wait-time estimate: defaults, rush throughput, outliers, quiet gaps, recent-vs-old |
| `auth` | Admin login, 2FA, sessions, origin checks, rate limits |
| `code` | Shop code login with spaces / caps |
| `archive` | Archive, restore, delete forever (and nothing else deleted) |
| `forgot` | Forgot PIN requests, no code enumeration, admin side |
| `phone` | Shop phone number, forgot-PIN callback number |
| `live` | Live orders over realtime |
| `push` | Admin push notifications |
| `i18n` | Translated error codes, customer push in their language |
| `queue` | Customer queue: last served, orders ahead (forgotten + other shops ignored), estimate, live ping, no ids leaked |
| `staff-push` | Staff phones: support replies + broadcasts in their language, pruning, delete |
| `ui-states` | Browser: archived / paused / deleted / expired screens |
| `ui-install` | Browser: Add to Home Screen on iPhone, Android, in-app |
| `ui-offline` | Browser: offline page from the service worker |

Lint is blocking: any ESLint error fails the run (warnings are only reported).

Needs Node 22.18+ (runs the `.ts` unit test directly), Python 3 with
`pip install playwright && python -m playwright install chromium`, and
`openssl` (the push suites are skipped without it). Ports 3100, 54321 and
8443 must be free.

**Adding a test:** print one line per check starting with `PASS` or `FAIL`
(see any file in `tests/e2e/`), then add it to `SUITES` in `tests/ci/run.mjs`.
Every suite starts on an empty database.
