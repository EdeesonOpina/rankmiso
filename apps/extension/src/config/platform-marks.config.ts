/**
 * Platform marks shown beside a platform's name. Files live in `public/platforms/`, are
 * bundled with the extension (never fetched), and are the owners' unmodified marks with
 * metadata stripped. Sources and terms are in docs/branding/third-party-marks.md.
 *
 * `mono` marks are drawn in black; dark themes invert them so they stay visible.
 * A platform with no entry shows its first letter instead.
 */
export interface PlatformMark {
  readonly file: string;
  readonly mono: boolean;
}

const mark = (file: string, mono = false): PlatformMark => ({ file, mono });

export const marks = {
  google: mark("google.svg"),
  gemini: mark("gemini.svg"),
  bing: mark("bing.svg"),
  copilot: mark("copilot.svg", true),
  duckduckgo: mark("duckduckgo.svg"),
  brave: mark("brave.svg"),
  apple: mark("apple.svg", true),
  yandex: mark("yandex.svg"),
  baidu: mark("baidu.svg"),
  openai: mark("openai.svg", true),
  claude: mark("claude.svg"),
  perplexity: mark("perplexity.svg"),
} as const satisfies Record<string, PlatformMark>;

/** Crawler-access platform id (crawlers.config) → mark. */
const byPlatform: Record<string, keyof typeof marks> = {
  "google-search": "google",
  "google-ai": "google",
  gemini: "gemini",
  bing: "bing",
  copilot: "copilot",
  duckduckgo: "duckduckgo",
  duckassist: "duckduckgo",
  brave: "brave",
  apple: "apple",
  yandex: "yandex",
  baidu: "baidu",
  chatgpt: "openai",
  claude: "claude",
  perplexity: "perplexity",
};

export function markFor(platformId: string): PlatformMark | undefined {
  const key = byPlatform[platformId];
  return key ? marks[key] : undefined;
}

export const markPath = (item: PlatformMark) => `/platforms/${item.file}`;
