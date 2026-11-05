# Lock-screen player: Now Playing card for the order, ring while locked.
import os, json, urllib.request, random
SHOTS=os.environ.get('SHOTS_DIR','shots'); os.makedirs(SHOTS, exist_ok=True)
from playwright.sync_api import sync_playwright
B='http://localhost:3100'; PG='http://127.0.0.1:54321'
fails=0
def ok(n,c,x=''):
    global fails
    print('PASS' if c else 'FAIL', n, '' if c else x); fails += 0 if c else 1
def ip(): return '8.%d.%d.%d'%(random.randint(1,250),random.randint(1,250),random.randint(1,250))
def http(m,u,b=None):
    r=urllib.request.urlopen(urllib.request.Request(u,data=None if b is None else json.dumps(b).encode(),method=m,headers={'content-type':'application/json','x-forwarded-for':ip(),'prefer':'return=representation'})); return json.loads(r.read() or b'{}')
s=http('POST',B+'/api/shops',{'name':'Lock Screen Shop','pin':'445566'})['shop']
http('PATCH',f"{PG}/rest/v1/shops?id=eq.{s['id']}",{'status':'active'})
order=http('POST',f"{PG}/rest/v1/orders",{'shop_id':s['id'],'order_number':'42','status':'preparing'})[0]

META="() => { const m = navigator.mediaSession && navigator.mediaSession.metadata; return m ? { title: m.title, artist: m.artist, album: m.album, art: (m.artwork||[]).length } : null }"
AUDIO="() => { const a = document.querySelector('[data-testid=lock-audio]'); return a ? { paused: a.paused, src: a.getAttribute('src') || '', loop: a.loop } : null }"

def wait_for(pg, fn, pred, ms=10000):
    v=None
    for _ in range(ms//250):
        v=pg.evaluate(fn)
        if pred(v): return v
        pg.wait_for_timeout(250)
    return v

with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])

    # Staff (to mark the order ready through the real API)
    sctx=b.new_context(extra_http_headers={'x-forwarded-for':ip()})
    sctx.add_init_script("localStorage.setItem('cup-locale','en')")
    sp=sctx.new_page(); sp.goto(B+'/barista'); sp.wait_for_timeout(700)
    sp.locator('input').nth(0).fill(s['code']); sp.locator('input').nth(1).fill('445566'); sp.keyboard.press('Enter')
    sp.wait_for_url('**/dashboard', timeout=15000)

    ctx=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, extra_http_headers={'x-forwarded-for':ip()})
    ctx.add_init_script("localStorage.setItem('cup-locale','en')")
    pg=ctx.new_page(); pg.goto(B+'/o/'+order['id']); pg.wait_for_timeout(2000)
    ok('no player before any tap', pg.evaluate(AUDIO) is None)
    sheet=pg.get_by_test_id('sound-sheet')
    ok('alerts sheet opens right away', sheet.count()==1 and sheet.get_by_text('Get alerted the moment it').count()==1)
    ok('sheet previews the lock screen', sheet.get_by_text('Order 42 · being prepared').count()==1 and sheet.get_by_text('Lock Screen Shop').count()==1)
    pg.screenshot(path=SHOTS+'/lock_sheet.png')
    pg.get_by_role('button', name='Turn on alerts').click()
    a=wait_for(pg, AUDIO, lambda v: v and not v['paused'])
    pg.wait_for_timeout(2200)
    ok('sheet closes once alerts are on', pg.get_by_test_id('sound-sheet').count()==0)
    ok('tap starts the silent loop', bool(a) and not a['paused'] and a['src'].endswith('/lockscreen.mp3') and a['loop'], a)
    m=wait_for(pg, META, lambda v: v and v['title'].startswith('Order 42'))
    ok('lock screen shows the order', bool(m) and (m['title']=='Order 42 · being prepared' or m['title'].startswith('Order 42 · ready in ~')), m)
    ok('lock screen shows the shop + artwork', bool(m) and m['artist']=='Lock Screen Shop' and m['album']=='Beep' and m['art']>=1, m)
    pg.screenshot(path=SHOTS+'/lock_preparing.png')

    r=sp.evaluate("async (id) => (await fetch('/api/orders/'+id, {method:'PATCH', headers:{'content-type':'application/json'}, body: JSON.stringify({status:'ready'})})).status", order['id'])
    ok('staff marks ready', r==200, r)
    m=wait_for(pg, META, lambda v: v and v['title']=='Order 42 · ready!')
    ok('lock screen says ready', bool(m) and m['title']=='Order 42 · ready!', m)
    a=wait_for(pg, AUDIO, lambda v: v and v['src'].endswith('/ready.mp3') and not v['paused'])
    ok('rings through the lock-screen player', bool(a) and a['src'].endswith('/ready.mp3') and not a['paused'], a)

    pg.get_by_role('button', name='Got it').click()
    m=wait_for(pg, META, lambda v: v is None, 4000)
    ok('Got it removes the lock-screen card', m is None, m)
    a=pg.evaluate(AUDIO)
    ok('Got it stops the sound', a is None or a['paused'], a)

    # French text on the lock screen
    o2=http('POST',f"{PG}/rest/v1/orders",{'shop_id':s['id'],'order_number':'43','status':'preparing'})[0]
    c2=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, extra_http_headers={'x-forwarded-for':ip()})
    c2.add_init_script("localStorage.setItem('cup-locale','fr')")
    p2=c2.new_page(); p2.goto(B+'/o/'+o2['id']); p2.wait_for_timeout(2000)
    p2.get_by_role('button', name='Activer les alertes').click()
    m=wait_for(p2, META, lambda v: v and v['title'].startswith('Commande 43'))
    ok('fr: lock screen in French', bool(m) and m['title'].startswith('Commande 43 · '), m)
    c2.close()

    # "Later": no sound, remembered for this order, small card still there
    o3=http('POST',f"{PG}/rest/v1/orders",{'shop_id':s['id'],'order_number':'44','status':'preparing'})[0]
    c3=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, extra_http_headers={'x-forwarded-for':ip()})
    c3.add_init_script("localStorage.setItem('cup-locale','en')")
    p3=c3.new_page(); p3.goto(B+'/o/'+o3['id']); p3.wait_for_timeout(2000)
    p3.get_by_role('button', name='Later').click(); p3.wait_for_timeout(400)
    ok('Later closes the sheet', p3.get_by_test_id('sound-sheet').count()==0)
    a=p3.evaluate(AUDIO)
    ok('Later does not start the sound', a is None or a['paused'], a)
    p3.reload(); p3.wait_for_timeout(2000)
    ok('Later is remembered for this order', p3.get_by_test_id('sound-sheet').count()==0)
    ok('small Enable sound card still offered', p3.get_by_role('button', name='Enable sound').count()==1)
    c3.close(); ctx.close(); sctx.close(); b.close()
print('\nALL PASS' if not fails else f'\n{fails} FAILED')
import sys; sys.exit(1 if fails else 0)
