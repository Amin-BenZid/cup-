import os
SHOTS=os.environ.get('SHOTS_DIR','shots'); os.makedirs(SHOTS, exist_ok=True)
import json, urllib.request, random
from playwright.sync_api import sync_playwright
B='http://localhost:3100'; PG='http://127.0.0.1:54321'
fails=0
def ok(n,c,x=''):
    global fails
    print('PASS' if c else 'FAIL', n, '' if c else x); fails += 0 if c else 1
def ip(): return '7.%d.%d.%d'%(random.randint(1,250),random.randint(1,250),random.randint(1,250))
def http(m,u,b=None):
    r=urllib.request.urlopen(urllib.request.Request(u,data=None if b is None else json.dumps(b).encode(),method=m,headers={'content-type':'application/json','x-forwarded-for':ip(),'prefer':'return=representation'})); return json.loads(r.read() or b'{}')
s=http('POST',B+'/api/shops',{'name':'Food Truck Zina','pin':'112233'})['shop']
http('PATCH',f"{PG}/rest/v1/shops?id=eq.{s['id']}",{'status':'active','phone':'+21622333444'})
order=http('POST',f"{PG}/rest/v1/orders",{'shop_id':s['id'],'order_number':'42','status':'preparing'})[0]
UA={
 'ios26':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
 'ios17':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
 'insta':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; fr_FR)',
 'android':'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
 'samsung':'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
}
FAKE_BIP = """
window.__fireBip = () => { const e = new Event('beforeinstallprompt'); e.prompt = async () => { window.__prompted = true }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) };
"""
with sync_playwright() as p:
    b=p.chromium.launch()
    def staff(ua, loc='fr', standalone=False):
        ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, user_agent=ua, has_touch=True, is_mobile=True, extra_http_headers={'x-forwarded-for':ip()})
        ctx.add_init_script(f"localStorage.setItem('cup-locale','{loc}');" + FAKE_BIP + ("Object.defineProperty(navigator,'standalone',{get:()=>true});" if standalone else ""))
        pg=ctx.new_page(); pg.goto(B+'/barista'); pg.wait_for_timeout(700)
        pg.locator('input').nth(0).fill(s['code']); pg.locator('input').nth(1).fill('112233'); pg.keyboard.press('Enter')
        pg.wait_for_url('**/dashboard', timeout=15000); pg.wait_for_timeout(1500)
        return ctx, pg

    # iPhone iOS 26 — French
    ctx,pg=staff(UA['ios26'])
    ok('iOS26: install card shown', pg.get_by_text('Installez Beep sur ce téléphone').count()==1)
    pg.screenshot(path=SHOTS+'/in_dash_ios26.png')
    pg.get_by_role('button', name='Ajouter à l’écran d’accueil').click(); pg.wait_for_timeout(500)
    ok('iOS26: guide starts with •••', pg.get_by_text('Touchez ••• en bas à droite').count()==1)
    ok('iOS26: web-app step', pg.get_by_text('Ouvrir en tant qu’app web', exact=False).count()==1)
    pg.screenshot(path=SHOTS+'/in_guide_ios26_fr.png')
    pg.get_by_role('button', name='J’ai compris').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Plus tard').last.click(); pg.wait_for_timeout(300)
    ok('Later hides the card', pg.get_by_text('Installez Beep sur ce téléphone').count()==0)
    pg.reload(); pg.wait_for_timeout(1500)
    ok('Later is remembered', pg.get_by_text('Installez Beep sur ce téléphone').count()==0)
    ctx.close()

    # iPhone iOS 17 — Arabic
    ctx,pg=staff(UA['ios17'],'ar')
    pg.locator('button', has_text='أضف إلى الشاشة الرئيسية').first.click(); pg.wait_for_timeout(500)
    ok('iOS17 (ar): Share at bottom step', pg.get_by_text('اضغط على زر المشاركة أسفل الشاشة').count()==1)
    pg.screenshot(path=SHOTS+'/in_guide_ios17_ar.png'); ctx.close()

    # Instagram in-app
    ctx,pg=staff(UA['insta'])
    pg.get_by_role('button', name='Ajouter à l’écran d’accueil').click(); pg.wait_for_timeout(500)
    ok('Instagram: open in Safari first', pg.get_by_text('Ouvrez d’abord dans votre navigateur').count()==1 and pg.get_by_text('Copier le lien').count()==1)
    pg.screenshot(path=SHOTS+'/in_guide_insta.png'); ctx.close()

    # Android Chrome with the native prompt → one tap
    ctx,pg=staff(UA['android'],'en')
    pg.evaluate('window.__fireBip()'); pg.wait_for_timeout(300)
    btn=pg.get_by_role('button', name='Add to Home Screen')
    ok('Android: card shown', pg.get_by_text('Install Beep on this phone').count()==1)
    btn.click(); pg.wait_for_timeout(500)
    ok('Android: one tap opens the native prompt', pg.evaluate('!!window.__prompted'))
    ok('Android: no guide when accepted', pg.get_by_text('Tap ⋮ at the top right').count()==0)
    pg.evaluate("window.dispatchEvent(new Event('appinstalled'))"); pg.wait_for_timeout(300)
    ok('Android: card gone after install', pg.get_by_text('Install Beep on this phone').count()==0)
    ctx.close()

    # Android Chrome without prompt → steps
    ctx,pg=staff(UA['android'],'en')
    pg.get_by_role('button', name='Add to Home Screen').click(); pg.wait_for_timeout(500)
    ok('Android no prompt: ⋮ steps', pg.get_by_text('Tap ⋮ at the top right').count()==1)
    pg.screenshot(path=SHOTS+'/in_guide_android.png'); ctx.close()

    # Samsung Internet
    ctx,pg=staff(UA['samsung'],'en')
    pg.get_by_role('button', name='Add to Home Screen').click(); pg.wait_for_timeout(500)
    ok('Samsung: ☰ steps', pg.get_by_text('Tap ☰ at the bottom right').count()==1); ctx.close()

    # Already on the Home Screen
    ctx,pg=staff(UA['ios26'], standalone=True)
    ok('Installed: no card', pg.get_by_text('Installez Beep sur ce téléphone').count()==0); ctx.close()

    # Desktop without prompt: nothing
    ctx=b.new_context(viewport={'width':1280,'height':800}, extra_http_headers={'x-forwarded-for':ip()}); ctx.add_init_script("localStorage.setItem('cup-locale','en')")
    pg=ctx.new_page(); pg.goto(B+'/barista'); pg.wait_for_timeout(700); pg.locator('input').nth(0).fill(s['code']); pg.locator('input').nth(1).fill('112233'); pg.keyboard.press('Enter'); pg.wait_for_url('**/dashboard', timeout=15000); pg.wait_for_timeout(1500)
    ok('Desktop: no card', pg.get_by_text('Install Beep on this phone').count()==0); ctx.close()

    # Customer order page on iPhone
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, user_agent=UA['ios26'], is_mobile=True, has_touch=True)
    # Like real iPhone Safari before installing: no push / notification API.
    ctx.add_init_script("localStorage.setItem('cup-locale','fr'); delete window.PushManager; delete window.Notification;")
    pg=ctx.new_page(); pg.goto(B+'/o/'+order['id']); pg.wait_for_timeout(2500)
    ok('Customer iPhone: hint + button', pg.get_by_text('Sur iPhone, ajoutez cette page', exact=False).count()==1)
    pg.screenshot(path=SHOTS+'/in_customer_ios.png', full_page=True)
    pg.get_by_role('button', name='Ajouter à l’écran d’accueil').click(); pg.wait_for_timeout(500)
    ok('Customer guide ends with turning on notifications', pg.get_by_text('activez les notifications', exact=False).count()==1)
    pg.screenshot(path=SHOTS+'/in_customer_guide.png'); ctx.close()

    # Customer on Android without prompt: no clutter
    ctx=b.new_context(viewport={'width':390,'height':844}, user_agent=UA['android'], is_mobile=True)
    pg=ctx.new_page(); pg.goto(B+'/o/'+order['id']); pg.wait_for_timeout(2000)
    ok('Customer Android (no prompt): no install button', pg.get_by_role('button', name='Ajouter à l’écran d’accueil').count()==0)
    ctx.close()

    b.close()
print('\nALL PASS' if not fails else f'\n{fails} FAILED')
