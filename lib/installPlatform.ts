/**
 * "Add to Home Screen" support differs sharply per platform:
 *
 * - Android/desktop Chromium fires `beforeinstallprompt`, so we can trigger the
 *   real OS install dialog — one tap, no instructions needed.
 * - iOS fires nothing and exposes no install API. The only route is the browser's
 *   own Share menu, so all we can do is show the exact taps.
 * - On iOS, only Safari can install a web app. Chrome/Firefox/etc. on iOS are
 *   Safari underneath but their share sheets don't offer "Add to Home Screen",
 *   so those users have to reopen the page in Safari first.
 */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

/** Already installed — running from the Home Screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari predates the display-mode media query for installed web apps
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports itself as desktop Safari on macOS; touch points give it away
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * iOS Safari vs. another browser on iOS. Every iOS browser embeds WebKit and says
 * "Safari" in its UA, so we detect by the vendor tokens the others *add*.
 */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Brave|DuckDuckGo/i.test(ua);
}

export function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "desktop";
  if (isIOS()) return isIOSSafari() ? "ios-safari" : "ios-other";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

/** The Chromium install event, which isn't in the DOM lib's type definitions. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
