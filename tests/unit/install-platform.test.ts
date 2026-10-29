import { detectInstallPlatform as d } from '../../src/lib/install-platform.ts'
let f = 0
const ok = (n: string, got: unknown, want: unknown) => { const g = JSON.stringify(got), w = JSON.stringify(want); console.log(g === w ? 'PASS' : 'FAIL', n, g === w ? '' : `got ${g} want ${w}`); if (g !== w) f++ }
const UA = {
  ios26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  ios17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  instaIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; fr_FR)',
  fbIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.104;FBBV/123]',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFb: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;]',
  androidTiktok: 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 musical_ly_2023',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
}
ok('iPhone iOS 26 Safari', d({ ua: UA.ios26 }), { kind: 'ios-safari', ipad: false, newUi: true })
ok('iPhone iOS 17 Safari', d({ ua: UA.ios17 }), { kind: 'ios-safari', ipad: false, newUi: false })
ok('iPad (desktop-mode UA)', d({ ua: UA.ipadMac, maxTouchPoints: 5 }), { kind: 'ios-safari', ipad: true, newUi: false })
ok('Chrome on iPhone', d({ ua: UA.chromeIos }), { kind: 'ios-browser', browser: 'chrome' })
ok('Firefox on iPhone', d({ ua: UA.firefoxIos }), { kind: 'ios-browser', browser: 'firefox' })
ok('Instagram on iPhone', d({ ua: UA.instaIos }), { kind: 'ios-inapp' })
ok('Facebook on iPhone', d({ ua: UA.fbIos }), { kind: 'ios-inapp' })
ok('Chrome on Android', d({ ua: UA.androidChrome }), { kind: 'android' })
ok('Samsung Internet', d({ ua: UA.samsung }), { kind: 'samsung' })
ok('Facebook on Android', d({ ua: UA.androidFb }), { kind: 'android-inapp' })
ok('TikTok on Android', d({ ua: UA.androidTiktok }), { kind: 'android-inapp' })
ok('Chrome on Windows', d({ ua: UA.desktopChrome }), { kind: 'desktop' })
ok('Safari on Mac (no touch)', d({ ua: UA.macSafari, maxTouchPoints: 0 }), { kind: 'desktop' })
ok('already installed', d({ ua: UA.ios26, standalone: true }), { kind: 'installed' })
console.log(f ? `\n${f} FAILED` : '\nALL PASS'); process.exitCode = f ? 1 : 0
