# Discoverability crawler access (M11.6, unreleased)

Where: full-page report and sidebar → Site intelligence → **Discoverability**. Nothing runs until the user chooses **Check access**. RankMiso first asks for access to the site (the existing optional host permission for that origin).

## What it reads

Two requests, same origin, without cookies:

1. `/robots.txt`, through Site Explorer's `readRobots` (10 s timeout, same-origin redirects only, first 80 KB).
2. The page itself, once (10 s timeout, same-origin redirects only, up to 512 KB). RankMiso reads the HTTP status, the `X-Robots-Tag` header, and `meta name=…` tags from the initial HTML. The HTML is parsed with `DOMParser` and never run.

The Rust engine (`seo-rules::crawler_access`, WASM `analyze_crawler_access`, input schema 1) then answers, for each crawler or token in the registry:

- **Crawl rule reading** from robots.txt: Allowed, Disallowed, No rule for this crawler, No robots.txt rules (4xx), robots.txt server error (5xx or 429), or Not measured. It records the group used and the deciding rule as written.
- **Indexing directives** that apply to that crawler: meta `robots`, meta named after the token (for example `googlebot`), and `X-Robots-Tag` values with no scope or that crawler's scope.
- **Microsoft AI preferences** set on the page: `ai-training` and `ai-grounding` in a `bingbot` meta tag or a `bingbot:`-scoped `X-Robots-Tag`.

These three are shown separately and never merged into one status.

## Where results are kept

The latest check for each page is kept in this extension's `localStorage` (key `rankmiso.crawlerAccess`), which the popup, sidebar, and report share. A check made in one window shows in the others, including Overview's platform snapshots, and survives a browser restart. Each result shows when it was checked; **Check access** replaces it. At most 20 pages and 1.5 MB are kept, oldest dropped first. Damaged data is ignored. Settings → reset clears it. Nothing is uploaded.

## robots.txt evaluation (RFC 9309)

One evaluator, `technical::robots_verdict`, is shared by this view, the page check `RULE_ROBOTS_TXT`, and Site Explorer's `crawl_permitted`.

- Product tokens match the `User-agent` value exactly, case-insensitively, ignoring a `/version` suffix. All groups that name the token are merged. `*` groups apply only when no group names it.
- Longest matching rule wins; `Allow` wins a tie. `*` wildcards and `$` anchors are supported.
- Paths include the query string and are compared after normalization: non-ASCII is percent-encoded, `%xx` uses upper-case hex, and escaped unreserved characters are decoded.
- `/robots.txt` is always allowed. Only the first 500 KiB is parsed (RankMiso fetches 80 KB).
- A 4xx response means no rules. A 5xx or 429 response means crawlers treat the site as fully disallowed; RankMiso shows "robots.txt server error", not "allowed". A request this browser could not make is "Not measured". It says nothing about crawlers.

For preference tokens (`Google-Extended`, `Applebot-Extended`, `__usage_ai-training`) read from the `*` group, the view adds that the provider may act only on rules naming the token.

## Registry

`apps/extension/src/config/crawlers.config.ts`. Official pages were read on 2026-11-25; Bing's help pages were rendered in a browser because they load client-side.

| Token                 | Role                                                                        | robots.txt, per the provider         | Source                              |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| Googlebot             | Google Search (also AI Overviews, AI Mode)                                  | follows                              | Google crawlers page                |
| Google-Extended       | preference token: Gemini apps, Vertex AI training and grounding; not Search | preference                           | Google-Extended page                |
| Bingbot               | Bing search; Copilot has no separate crawler                                | follows                              | Bing "Which crawlers does Bing use" |
| DuckDuckBot           | DuckDuckGo search                                                           | follows                              | DuckDuckGo help                     |
| DuckAssistBot         | DuckDuckGo AI-assisted answers; not training                                | follows (opt-out applies after 72 h) | DuckDuckGo help                     |
| Applebot              | Spotlight, Siri, Safari search                                              | follows                              | Apple support 119829                |
| Applebot-Extended     | preference token: Apple model training                                      | preference                           | Apple support 119829                |
| YandexBot             | Yandex search                                                               | follows                              | Yandex webmaster help               |
| Baiduspider           | Baidu search                                                                | follows                              | Baidu robots page                   |
| OAI-SearchBot         | ChatGPT search                                                              | follows                              | OpenAI bots page                    |
| GPTBot                | OpenAI model training                                                       | follows                              | OpenAI bots page                    |
| ChatGPT-User          | user-requested fetch                                                        | "may not apply"                      | OpenAI bots page                    |
| Claude-SearchBot      | Claude search                                                               | follows                              | Anthropic support                   |
| ClaudeBot             | Anthropic model training                                                    | follows                              | Anthropic support                   |
| Claude-User           | user-requested fetch                                                        | follows                              | Anthropic support                   |
| PerplexityBot         | Perplexity search; not training                                             | not stated                           | Perplexity docs                     |
| Perplexity-User       | user-requested fetch                                                        | "generally ignores"                  | Perplexity docs                     |
| `__usage_ai-training` | IETF AI-preferences training token; Microsoft honours it from 2027-02-01    | preference                           | Bing blog, 2026-10-30               |

Platforms without a crawler of their own are explicit. Brave Search publishes no user agent and says it crawls only what Googlebot may crawl, so its card shows the Googlebot reading. Yahoo Search is "Not supported": its help pages do not say which index supplies results. Microsoft's MicrosoftPreview (page snapshots) and AdIdxBot (ads) are documented but not search or AI crawlers, so they are not listed.

## Microsoft AI preferences

From Microsoft's post of 30 October 2026: AI Training can be set in robots.txt (`User-Agent: __usage_ai-training`) or per page (`<meta name="Bingbot" content="ai-training:disallow">`, `X-Robots-Tag: Bingbot: ai-training:disallow`); the page setting overrides robots.txt. AI Grounding is page-level only (`ai-grounding:allow|disallowextended|disallow`); there is no robots.txt grounding preference. Both default to allow, take effect from 1 February 2027 as Microsoft recrawls pages, and govern content use, not crawl access. Before that date the view labels them "Announced".

## Limits

- These are readings of published rules. RankMiso's requests are not made by Googlebot or GPTBot; firewalls, bot management, and IP rules may treat real crawlers differently. Nothing here says a page is crawled, indexed, ranked, or cited.
- Meta tags are read from the initial HTML, as a crawler that does not render would see them. Tags added by JavaScript are not counted here (see JavaScript SEO diagnostics, M11.1).
- robots.txt is read up to 80 KB, as in Site Explorer.
- Results are not saved or exported.
- No logos: platform marks are neutral monograms. OpenAI and Microsoft require permission or a licence for logo use, and Google allows its logo only in informational contexts and not in marketing material. Logos will be added only per brand with written permission on file.
- Firefox: the view and requests use the same code as Site Explorer, which runs on Firefox, but this feature has not been exercised in a Firefox runtime.
