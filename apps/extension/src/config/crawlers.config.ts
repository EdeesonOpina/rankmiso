/**
 * Documented search and AI crawlers, the platforms they serve, and the robots.txt control
 * tokens that are not crawlers at all. Every entry comes from the provider's own page, read on
 * `reviewedOn`. Nothing here is inferred from third-party lists.
 *
 * A platform is a product people use. A crawler or token is what robots.txt can name. One
 * platform can depend on several crawlers, and one crawler can serve several platforms
 * (Googlebot serves Google Search and its AI features).
 */

/** What a token does. `content-use` tokens never crawl; they only carry a preference. */
export type CrawlerKind = "search" | "ai-search" | "ai-training" | "user-fetch" | "content-use";

/** What the provider's page says about robots.txt for this token. */
export type RobotsBehaviour = "obeys" | "may-ignore" | "ignores" | "preference" | "not-stated";

export type SupportLevel = "verified" | "partial" | "informational" | "unsupported";

export interface CrawlerDefinition {
  readonly id: string;
  /** robots.txt product token, exactly as the provider writes it. */
  readonly token: string;
  readonly kind: CrawlerKind;
  readonly robots: RobotsBehaviour;
  readonly documentationUrl: string;
  readonly reviewedOn: string;
}

export interface PlatformDefinition {
  readonly id: string;
  /** Product name in plain text. Names belong to their owners; no logo is bundled. */
  readonly name: string;
  readonly group: "search" | "ai";
  /** First entry is the one the platform's status follows. Empty when nothing is documented. */
  readonly crawlerIds: readonly string[];
  readonly supportLevel: SupportLevel;
  readonly documentationUrl: string;
}

const REVIEWED = "2026-11-25";
const GOOGLE_CRAWLERS =
  "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers";
const OPENAI = "https://developers.openai.com/api/docs/bots";
const ANTHROPIC =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const PERPLEXITY = "https://docs.perplexity.ai/docs/resources/perplexity-crawlers";
const APPLE = "https://support.apple.com/en-us/119829";
export const MICROSOFT_PREFERENCES_URL =
  "https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/";

export const crawlers: readonly CrawlerDefinition[] = [
  crawler("googlebot", "Googlebot", "search", "obeys", GOOGLE_CRAWLERS),
  crawler(
    "google-extended",
    "Google-Extended",
    "content-use",
    "preference",
    "https://developers.google.com/crawling/docs/google-extended",
  ),
  crawler(
    "bingbot",
    "Bingbot",
    "search",
    "obeys",
    "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
  ),
  crawler(
    "duckduckbot",
    "DuckDuckBot",
    "search",
    "obeys",
    "https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot",
  ),
  crawler(
    "duckassistbot",
    "DuckAssistBot",
    "ai-search",
    "obeys",
    "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot",
  ),
  crawler("applebot", "Applebot", "search", "obeys", APPLE),
  crawler("applebot-extended", "Applebot-Extended", "content-use", "preference", APPLE),
  crawler(
    "yandexbot",
    "YandexBot",
    "search",
    "obeys",
    "https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html",
  ),
  crawler(
    "baiduspider",
    "Baiduspider",
    "search",
    "obeys",
    "https://www.baidu.com/search/robots_english.html",
  ),
  crawler("oai-searchbot", "OAI-SearchBot", "ai-search", "obeys", OPENAI),
  crawler("gptbot", "GPTBot", "ai-training", "obeys", OPENAI),
  crawler("chatgpt-user", "ChatGPT-User", "user-fetch", "may-ignore", OPENAI),
  crawler("claude-searchbot", "Claude-SearchBot", "ai-search", "obeys", ANTHROPIC),
  crawler("claudebot", "ClaudeBot", "ai-training", "obeys", ANTHROPIC),
  crawler("claude-user", "Claude-User", "user-fetch", "obeys", ANTHROPIC),
  crawler("perplexitybot", "PerplexityBot", "ai-search", "not-stated", PERPLEXITY),
  crawler("perplexity-user", "Perplexity-User", "user-fetch", "ignores", PERPLEXITY),
  crawler(
    "usage-ai-training",
    "__usage_ai-training",
    "content-use",
    "preference",
    MICROSOFT_PREFERENCES_URL,
  ),
];

export const platforms: readonly PlatformDefinition[] = [
  platform("google-search", "Google Search", "search", ["googlebot"], "verified", GOOGLE_CRAWLERS),
  platform("bing", "Microsoft Bing", "search", ["bingbot"], "verified", crawlerUrl("bingbot")),
  platform(
    "duckduckgo",
    "DuckDuckGo",
    "search",
    ["duckduckbot"],
    "partial",
    crawlerUrl("duckduckbot"),
  ),
  // Brave documents no user agent of its own and limits crawling to what Googlebot may crawl.
  platform(
    "brave",
    "Brave Search",
    "search",
    ["googlebot"],
    "informational",
    "https://search.brave.com/help/brave-search-crawler",
  ),
  platform("apple", "Apple (Spotlight, Siri, Safari)", "search", ["applebot"], "verified", APPLE),
  platform("yandex", "Yandex", "search", ["yandexbot"], "verified", crawlerUrl("yandexbot")),
  platform("baidu", "Baidu", "search", ["baiduspider"], "partial", crawlerUrl("baiduspider")),
  platform(
    "yahoo",
    "Yahoo Search",
    "search",
    [],
    "unsupported",
    "https://help.yahoo.com/kb/search-for-desktop",
  ),
  platform(
    "chatgpt",
    "ChatGPT search",
    "ai",
    ["oai-searchbot", "chatgpt-user"],
    "verified",
    OPENAI,
  ),
  // AI Overviews and AI Mode use the Search index; Googlebot rules are the control.
  platform(
    "google-ai",
    "Google AI Overviews and AI Mode",
    "ai",
    ["googlebot"],
    "verified",
    "https://developers.google.com/search/docs/appearance/ai-features",
  ),
  platform(
    "gemini",
    "Gemini apps",
    "ai",
    ["google-extended"],
    "verified",
    crawlerUrl("google-extended"),
  ),
  // Microsoft documents no separate Copilot crawler; Copilot grounding uses Bing's crawl.
  platform("copilot", "Microsoft Copilot", "ai", ["bingbot"], "partial", MICROSOFT_PREFERENCES_URL),
  platform("claude", "Claude", "ai", ["claude-searchbot", "claude-user"], "verified", ANTHROPIC),
  platform(
    "perplexity",
    "Perplexity",
    "ai",
    ["perplexitybot", "perplexity-user"],
    "partial",
    PERPLEXITY,
  ),
  platform(
    "duckassist",
    "DuckDuckGo AI-assisted answers",
    "ai",
    ["duckassistbot"],
    "verified",
    crawlerUrl("duckassistbot"),
  ),
];

/** Tokens listed under content use: model-training crawlers and preference-only tokens. */
export const contentUseCrawlerIds: readonly string[] = [
  "gptbot",
  "claudebot",
  "google-extended",
  "applebot-extended",
  "usage-ai-training",
];

export function crawlerById(id: string): CrawlerDefinition | undefined {
  return crawlers.find((entry) => entry.id === id);
}

function crawler(
  id: string,
  token: string,
  kind: CrawlerKind,
  robots: RobotsBehaviour,
  documentationUrl: string,
): CrawlerDefinition {
  return { id, token, kind, robots, documentationUrl, reviewedOn: REVIEWED };
}

function platform(
  id: string,
  name: string,
  group: "search" | "ai",
  crawlerIds: readonly string[],
  supportLevel: SupportLevel,
  documentationUrl: string,
): PlatformDefinition {
  return { id, name, group, crawlerIds, supportLevel, documentationUrl };
}

function crawlerUrl(id: string): string {
  const found = crawlers.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown crawler ${id}`);
  return found.documentationUrl;
}

/** AI answer surfaces a user can record observations for (M11.7). `platformId` links to the
 * crawler-access platform where one exists. Links open the product home page; RankMiso never
 * queries these services. */
export interface VisibilityPlatform {
  readonly id: string;
  readonly name: string;
  readonly homeUrl: string;
  readonly platformId: string;
}

export const visibilityPlatforms: readonly VisibilityPlatform[] = [
  { id: "chatgpt", name: "ChatGPT search", homeUrl: "https://chatgpt.com/", platformId: "chatgpt" },
  {
    id: "google-ai-overviews",
    name: "Google AI Overviews",
    homeUrl: "https://www.google.com/",
    platformId: "google-ai",
  },
  {
    id: "google-ai-mode",
    name: "Google AI Mode",
    homeUrl: "https://www.google.com/",
    platformId: "google-ai",
  },
  { id: "gemini", name: "Gemini", homeUrl: "https://gemini.google.com/", platformId: "gemini" },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    homeUrl: "https://copilot.microsoft.com/",
    platformId: "copilot",
  },
  { id: "claude", name: "Claude", homeUrl: "https://claude.ai/", platformId: "claude" },
  {
    id: "perplexity",
    name: "Perplexity",
    homeUrl: "https://www.perplexity.ai/",
    platformId: "perplexity",
  },
  {
    id: "duckassist",
    name: "DuckDuckGo AI-assisted answers",
    homeUrl: "https://duckduckgo.com/",
    platformId: "duckassist",
  },
];
