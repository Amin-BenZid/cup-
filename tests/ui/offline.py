import os
SHOTS=os.environ.get('SHOTS_DIR','shots'); os.makedirs(SHOTS, exist_ok=True)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844}, service_workers='allow')
    pg=ctx.new_page(); pg.set_default_timeout(15000)
    pg.goto('http://localhost:3100/barista'); pg.wait_for_timeout(2000)
    pg.evaluate("navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(r => !!r.active)")
    pg.reload(); pg.wait_for_timeout(1500)
    ok=lambda n,c: print('PASS' if c else 'FAIL', n)
    ok('service worker controls the page', pg.evaluate("!!navigator.serviceWorker.controller"))
    ctx.set_offline(True)
    try:
        pg.goto('http://localhost:3100/barista/dashboard', timeout=10000)
    except Exception as e: print('nav:', str(e)[:120])
    pg.wait_for_timeout(800)
    ok('offline: friendly page instead of browser error', 'No connection' in pg.content())
    pg.screenshot(path=SHOTS+'/in_offline.png')
    ctx.set_offline(False)
    pg.goto('http://localhost:3100/barista', timeout=10000); pg.wait_for_timeout(800)
    ok('back online: normal page', 'No connection' not in pg.content())
    b.close()
