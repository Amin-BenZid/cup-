/**
 * Which "add to Home Screen" path this browser has. Pure, so it can be tested
 * against real user agents.
 *
 *   installed     already running from the Home Screen: show nothing
 *   ios-safari    Safari on iPhone/iPad (newUi = iOS 26+, Share is under •••)
 *   ios-browser   Chrome / Firefox / Edge on iPhone (iOS 16.4+ can add too)
 *   ios-inapp     Instagram, Facebook, TikTok… in-app browser: can't add,
 *                 the page must be opened in Safari first
 *   android       Android browser (Chrome-like menu ⋮)
 *   samsung       Samsung Internet (menu ☰ at the bottom)
 *   android-inapp in-app browser on Android: open in Chrome first
 *   desktop       computer; only offered when the browser has its own prompt
 */
export type InstallPlatform =
  | { kind: "installed" }
  | { kind: "ios-safari"; ipad: boolean; newUi: boolean }
  | { kind: "ios-browser"; browser: "chrome" | "firefox" | "edge" | "other" }
  | { kind: "ios-inapp" }
  | { kind: "android" }
  | { kind: "samsung" }
  | { kind: "android-inapp" }
  | { kind: "desktop" };

const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|musical_ly|BytedanceWebview|TikTok|Snapchat|LinkedInApp|Twitter|GSA\/|Pinterest/i;

export function detectInstallPlatform(env: {
  ua: string;
  maxTouchPoints?: number;
  platform?: string;
  standalone?: boolean;
}): InstallPlatform {
  const { ua } = env;
  if (env.standalone) return { kind: "installed" };

  // iPadOS reports itself as a Mac; touch points give it away.
  const ipadAsMac = /Macintosh/.test(ua) && (env.maxTouchPoints ?? 0) > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || ipadAsMac;

  if (ios) {
    if (IN_APP.test(ua)) return { kind: "ios-inapp" };
    if (/CriOS/.test(ua)) return { kind: "ios-browser", browser: "chrome" };
    if (/FxiOS/.test(ua)) return { kind: "ios-browser", browser: "firefox" };
    if (/EdgiOS/.test(ua)) return { kind: "ios-browser", browser: "edge" };
    // Real Safari has "Version/x" and "Safari/"; other WebViews usually don't.
    if (!/Version\/\d+/.test(ua) || !/Safari\//.test(ua)) return { kind: "ios-inapp" };
    const major = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return { kind: "ios-safari", ipad: /iPad/.test(ua) || ipadAsMac, newUi: major >= 26 };
  }

  if (/Android/i.test(ua)) {
    if (IN_APP.test(ua) || /; wv\)/.test(ua)) return { kind: "android-inapp" };
    if (/SamsungBrowser/.test(ua)) return { kind: "samsung" };
    return { kind: "android" };
  }

  return { kind: "desktop" };
}
