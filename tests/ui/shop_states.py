import os
SHOTS=os.environ.get('SHOTS_DIR','shots'); os.makedirs(SHOTS, exist_ok=True)
import json, urllib.request, random, sys, time
from playwright.sync_api import sync_playwright
B='http://localhost:3100'; PG='http://127.0.0.1:54321'
fails=0
def ok(n,c,x=''):
    global fails
    print('PASS' if c else 'FAIL', n, '' if c else x); fails += (0 if c else 1)
def ip(): return '4.%d.%d.%d'%(random.randint(1,250),random.randint(1,250),random.randint(1,250))
def http(method, url, body=None, headers=None):
    h={'content-type':'application/json'}; h.update(headers or {})
    req=urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method=method, headers=h)
    try:
        r=urllib.request.urlopen(req); return r.status, json.loads(r.read() or b'{}'), r.headers
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}'), e.headers
def pgpatch(sid, body): http('PATCH', f'{PG}/rest/v1/shops?id=eq.{sid}', body)
admin_cookie=''
def admin(method, path, body=None):
    global admin_cookie
    st,j,h=http(method, B+path, body, {'origin':B,'x-forwarded-for':ip(),'cookie':admin_cookie})
    sc=h.get('set-cookie') or ''
    if 'admin_session=' in sc: admin_cookie=sc.split(';')[0]
    return st,j
admin('POST','/api/admin/login',{'password':'test-password-123'})
def mk(name, status='active'):
    st,j,_=http('POST', B+'/api/shops', {'name':name,'pin':'112233'}, {'x-forwarded-for':ip()})
    s=j['shop']; pgpatch(s['id'], {'status':status}); return s

with sync_playwright() as p:
    b=p.chromium.launch()
    def session(shop):
        ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, extra_http_headers={'x-forwarded-for':ip()})
        ctx.add_init_script("localStorage.setItem('cup-locale','en')")
        pg=ctx.new_page()
        dialogs=[]; pg.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
        pg.goto(B+'/barista'); pg.wait_for_timeout(800)
        pg.locator('input').nth(0).fill(shop['code']); pg.locator('input').nth(1).fill('112233'); pg.keyboard.press('Enter')
        pg.wait_for_url('**/barista/dashboard', timeout=15000)
        return ctx, pg, dialogs
    def heading(pg): return pg.locator('h1').first.inner_text()

    # 1. archived while logged in
    s=mk('States A '+str(random.randint(100,999)))
    ctx,pg,dialogs=session(s)
    admin('POST', f"/api/admin/shops/{s['id']}/archive", {'action':'archive'})
    pg.reload(); pg.wait_for_url('**/expired**', timeout=15000); pg.wait_for_timeout(1200)
    ok('archived → "This shop is closed"', heading(pg)=='This shop is closed', heading(pg))
    ok('archived: no chat button', pg.get_by_role('button', name='Support').count()==0 and pg.get_by_text('Contact support').count()>=1)
    pg.screenshot(path=SHOTS+'/st_archived.png')

    # 2. restore → page goes back to dashboard by itself
    admin('POST', f"/api/admin/shops/{s['id']}/archive", {'action':'restore'})
    try:
        pg.wait_for_url('**/barista/dashboard', timeout=40000); ok('restore → back to dashboard automatically', True)
    except Exception as e: ok('restore → back to dashboard automatically', False, str(e)[:100])

    # 3. paused (disabled) → paused screen, chat works
    pgpatch(s['id'], {'status':'disabled'})
    pg.reload(); pg.wait_for_url('**/expired**', timeout=15000); pg.wait_for_timeout(1200)
    ok('disabled → "Your shop is paused"', heading(pg)=='Your shop is paused', heading(pg))
    chat=pg.locator('main button', has_text='Support')
    ok('paused: chat button shown', chat.count()==1, pg.locator('main button').all_inner_texts())
    pg.screenshot(path=SHOTS+'/st_paused.png')
    chat.click(); pg.wait_for_timeout(800)
    pg.locator('input[type=text]').last.fill('why paused?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    ok('paused: message sent', pg.get_by_text('why paused?').count()>=1)

    # 4. network failure while sending → inline error, no alert
    pg.route('**/api/support', lambda r: r.abort() if r.request.method=='POST' else r.continue_())
    pg.locator('input[type=text]').last.fill('offline msg'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1000)
    ok('network error → inline message', pg.get_by_text('No connection. Check your internet and try again.').count()==1)
    pg.screenshot(path=SHOTS+'/st_chat_error.png')
    pg.unroute('**/api/support')

    # 5. café deleted while the chat is open → send → deleted screen, no alert
    admin('POST', f"/api/admin/shops/{s['id']}/archive", {'action':'archive'})
    admin('DELETE', f"/api/admin/shops/{s['id']}", {'confirm': s['code']})
    pg.locator('input[type=text]').last.fill('hello?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    ok('deleted → "This shop no longer exists"', heading(pg)=='This shop no longer exists', heading(pg))
    ok('deleted: create new café button', pg.get_by_role('link', name='Create a new shop').count()==1)
    pg.screenshot(path=SHOTS+'/st_deleted.png')
    pg.wait_for_timeout(32000)
    ok('deleted screen stays (no bounce to login)', '/expired' in pg.url and heading(pg)=='This shop no longer exists', pg.url)
    ok('storage cleared', pg.evaluate("localStorage.getItem('shop_id')") is None)
    ok('no browser alerts at all', dialogs==[], dialogs)
    ctx.close()

    # 6. deleted while on the dashboard (no chat)
    s=mk('States B '+str(random.randint(100,999)))
    ctx,pg,dialogs=session(s)
    admin('POST', f"/api/admin/shops/{s['id']}/archive", {'action':'archive'}); admin('DELETE', f"/api/admin/shops/{s['id']}", {'confirm': s['code']})
    pg.reload(); pg.wait_for_timeout(3000)
    ok('deleted from dashboard → deleted screen', '/expired' in pg.url and heading(pg)=='This shop no longer exists', (pg.url, heading(pg)))
    pg.get_by_text('Back to login').click(); pg.wait_for_url('**/barista', timeout=10000)
    ok('back to login works', pg.url.endswith('/barista'))
    ctx.close()

    # 7. trial ended vs subscription ended
    s=mk('States C '+str(random.randint(100,999)))
    ctx,pg,dialogs=session(s)
    pgpatch(s['id'], {'trial_ends_at':'2020-01-01T00:00:00Z','subscription_ends_at':None,'billing_status':'trial'})
    pg.reload(); pg.wait_for_url('**/expired**', timeout=15000); pg.wait_for_timeout(1200)
    ok('trial over → "Your free trial has ended"', heading(pg)=='Your free trial has ended', heading(pg))
    pg.screenshot(path=SHOTS+'/st_trial.png')
    pgpatch(s['id'], {'subscription_ends_at':'2021-01-01T00:00:00Z','billing_status':'active'})
    pg.reload(); pg.wait_for_timeout(1500)
    ok('subscription over → "Your subscription has ended"', heading(pg)=='Your subscription has ended', heading(pg))
    pgpatch(s['id'], {'subscription_ends_at':'2030-01-01T00:00:00Z'})
    try:
        pg.wait_for_url('**/barista/dashboard', timeout=40000); ok('renewed → back to dashboard automatically', True)
    except Exception as e: ok('renewed → back to dashboard automatically', False, str(e)[:80])
    ctx.close()

    # 8. pending café deleted
    s=mk('States D '+str(random.randint(100,999)), status='pending')
    ctx=b.new_context(viewport={'width':390,'height':844}); ctx.add_init_script("localStorage.setItem('cup-locale','en')")
    pg=ctx.new_page(); pg.goto(B+'/barista'); pg.evaluate(f"localStorage.setItem('shop_id','{s['id']}');localStorage.setItem('shop_name','x')")
    pg.goto(B+'/pending'); pg.wait_for_timeout(1500)
    ok('pending shows waiting', heading(pg)=='Waiting for approval', heading(pg))
    admin('POST', f"/api/admin/shops/{s['id']}/archive", {'action':'archive'}); admin('DELETE', f"/api/admin/shops/{s['id']}", {'confirm': s['code']})
    pg.wait_for_timeout(6500)
    ok('pending → deleted screen', heading(pg)=='This shop no longer exists', heading(pg))
    ctx.close()
    b.close()
print('\nALL PASS' if not fails else f'\n{fails} FAILED')
