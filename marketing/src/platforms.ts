/**
 * Store image sizes checked 2026-10-28.
 * Chrome: https://developer.chrome.com/docs/webstore/images
 *   Screenshots 1280×800 or 640×400, square corners, full bleed.
 *   Small promo 440×280. Marquee promo 1400×560.
 * Firefox: https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/
 *   Recommended capture 1280×800, ratio 1.6:1.
 * Apple: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
 *   Mac accepts 2880×1800 (16:10). No alpha.
 *   iPhone Dynamic Island medium includes 1206×2622.
 *   iPad 13-inch includes 2064×2752.
 *   Those mobile sizes are recorded and not exported: RankMiso has no iOS or iPadOS app.
 */

export interface FrameSize {
  width: number;
  height: number;
}

export interface ScreenshotSet {
  id: "chrome" | "firefox" | "safari-macos";
  /** Directory under marketing/output. */
  dir: string;
  size: FrameSize;
  count: number;
  /** How many of `count` a store listing can actually accept. */
  uploadMax: number;
  /** True only when the pixels come from that browser's extension runtime. */
  nativeRuntime: boolean;
  /** Store upload still needs a human check on that platform. */
  submissionReady: boolean;
  note: string;
}

export const chromeScreenshots: ScreenshotSet = {
  id: "chrome",
  dir: "chrome",
  size: { width: 1280, height: 800 },
  count: 9,
  uploadMax: 5,
  nativeRuntime: true,
  submissionReady: true,
  note: "Captured from the Chromium extension build. The Chrome Web Store accepts 5 screenshots. Use 01–05, or swap in 06–09.",
};

export const firefoxScreenshots: ScreenshotSet = {
  id: "firefox",
  dir: "firefox",
  size: { width: 1280, height: 800 },
  count: 9,
  uploadMax: 9,
  nativeRuntime: false,
  submissionReady: false,
  note: "Same RankMiso interface as the Chromium capture. Playwright in this repository does not load the Firefox add-on, so these are not Firefox runtime screenshots. No Chrome window is drawn. Firefox can list more than five screenshots.",
};

export const safariScreenshots: ScreenshotSet = {
  id: "safari-macos",
  dir: "safari/macos",
  size: { width: 2880, height: 1800 },
  count: 9,
  uploadMax: 10,
  nativeRuntime: false,
  submissionReady: false,
  note: "Provisional Mac composition. RankMiso has no Safari extension in this repository. Rendered at 2880×1800, not upscaled from the Chrome file. Native Safari verification is required before submission. The Mac App Store accepts up to 10 screenshots.",
};

export const chromePromo = {
  small: { width: 440, height: 280, file: "promo-small.png" },
  marquee: { width: 1400, height: 560, file: "promo-marquee.png" },
} as const;

export const iosTargets = {
  supported: false,
  reason:
    "RankMiso is a desktop browser extension. There is no iOS or iPadOS Safari target, so mobile screenshots are not generated.",
  iphone: { width: 1206, height: 2622 },
  ipad: { width: 2064, height: 2752 },
} as const;

export const sets = [chromeScreenshots, firefoxScreenshots, safariScreenshots] as const;

export const canvas = "#f3f5f8";
