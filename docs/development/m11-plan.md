# M11 — v0.7.1 plan and checkpoint record

Branch `feature/m11-v0.7.1-seo-intelligence`, worktree `/home/ed/Projects/Rust/rankmiso-m11`, based on `origin/develop` at `760dfb1` (same tree as `master` `0b2bc1d`, v0.7.0). Written 2026-11-25.

M11.0 and M11.1 are done in this checkpoint. M11.2–M11.8 are plans only and need owner approval before work starts. A documented plan is not a finished feature.

| ID    | Feature                                    | State                                                                                                                  |
| ----- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| M11.0 | Release hardening and marketing compliance | Marketing source fix merged to `develop` (#64). Store warning resolved; listing approved by Google (owner).            |
| M11.1 | JavaScript SEO diagnostics                 | Merged to `develop` (#65). See `docs/features/javascript-seo.md`.                                                      |
| M11.2 | Redirect intelligence                      | Implemented on `feature/v0.7.1-m11-integration`. See `docs/features/redirects.md`.                                     |
| M11.3 | Canonical and hreflang intelligence        | Implemented on `feature/v0.7.1-m11-integration`. See `docs/features/canonical-hreflang.md`.                            |
| M11.4 | Structured data intelligence               | Plan                                                                                                                   |
| M11.5 | AIO/GEO content analysis                   | Implemented locally on `feature/m11.5-aio-geo-readiness` (stacked on M11.6). See `docs/features/content-readiness.md`. |
| M11.6 | AI and search crawler accessibility        | Implemented locally on `feature/m11.6-crawler-accessibility`; not pushed. See `docs/features/crawler-access.md`.       |
| M11.7 | AI platform visibility and citations       | Plan                                                                                                                   |
| M11.8 | Platform branding and UI integration       | Plan, with licence findings                                                                                            |

## M11.0 — baseline record

### v0.7.0 acceptance gaps

Nothing in this list was run in this checkpoint. Each row keeps its last known state.

| Check                                              | State                          | Note                                                                          |
| -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Firefox popup, sidebar, full report                | Not performed                  | Earlier Firefox 158 run used a Marionette test profile, not a normal install. |
| Firefox Site Explorer crawl                        | Not performed                  |                                                                               |
| Firefox snapshot persistence and CSV/JSON export   | Not performed                  |                                                                               |
| Permission grant, deny, revoke, re-grant (Chrome)  | Not performed                  | Playwright pre-grants host access.                                            |
| Permission grant, deny, revoke, re-grant (Firefox) | Not performed                  |                                                                               |
| Native Messaging permission prompt                 | Not performed                  | The E2E run pre-granted it.                                                   |
| Restart persistence, signed Firefox install        | Blocked                        | Needs an AMO-signed build. A temporary add-on is not a persistence test.      |
| Chrome restart persistence                         | Passed (v0.7.0 release review) | Recorded in PR #63.                                                           |

### Store status

The owner reports v0.7.0 was submitted to the Chrome Web Store and Firefox Add-ons. This checkpoint has no dashboard access, so approval and publication are unknown. No GitHub release tag exists for v0.7.0. That does not show it was not submitted. On 25 November 2026 Chrome Web Store support issued a policy warning (violation reference Red Nickel) against the promo images. See `docs/releases/marketing-compliance-v071.md` on the fix branch.

### Stale records to correct (historical text kept as is)

- The R9 handoff (16 November) says PR #60 is open with CI running. PRs #60, #61, #62, and #63 were all merged on 16 November, and `master` is `0b2bc1d` with packages at 0.7.0.
- The R9 handoff says the extension stays at 0.6.0. PR #61 aligned it to 0.7.0.
- The ENOSPC recovery note points to `/tmp/rankmiso-v07-marketing-final` (80 images) and `/tmp/rankmiso-v07-recovery`. Both are gone: `/tmp` is tmpfs and was cleared. The 80-image set was regenerated from `master` on the fix branch.
- `marketing/src/capture.ts` on `master` cannot render v0.7.0: it waits for a removed heading and never saves the seven `site-*` captures. Fixed on the fix branch.
- PR #59 records "Marketing validation: 80 images, PASS". That could not be reproduced from `master` until the capture fix above.

These belong in the local handoff and progress logs, and in release notes if v0.7.0 notes are revised. Earlier entries stay unchanged.

## Checkpoint 3 — M11.5 content readiness (2026-11-25)

Git: `develop` 5d1bfa1 contains M11.0 (#64) and M11.1 (#65). M11.6 was never pushed (not authorized), so it is not in `develop`. M11.5 depends on M11.6 (the AI & Search section and crawler results), so the local M11.6 branch was rebased onto 5d1bfa1 (e779b9c, 19f96c3; no shared history rewritten) and M11.5 is stacked on it. Review and merge M11.6 first.

### Official guidance read for M11.5 (2026-11-25)

| Source                                                   | URL                                                                                                            | What it supports                                                                                                                                                                                                                                                                                                                                              | RankMiso measures                                                                                          | RankMiso cannot measure                                    | Scope               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| Google: AI features and your website                     | https://developers.google.com/search/docs/appearance/ai-features                                               | No additional requirements, special files, markup, or schema for AI Overviews and AI Mode; page must be indexed and snippet-eligible; content available as text; structured data should match visible text; nosnippet, data-nosnippet, max-snippet, noindex limit what is shown                                                                               | snippet directives in meta and X-Robots-Tag; noindex; JSON-LD headline vs visible title and headings       | actual indexing, snippet eligibility, data-nosnippet spans | Google              |
| Google: Optimizing for generative AI features            | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide                                   | No AI text files or Markdown needed (neither helps nor harms); structured data not required; JavaScript content processed if not blocked; clear headings; semantic HTML "generally a good idea"; GEO/AEO is still SEO. Also says a site must be included in Search generative AI features in Search Console, which page 1 does not mention (open discrepancy) | heading structure; main/article region; rendering differences (M11.1 result)                               | Search Console settings                                    | Google              |
| Google: Creating helpful, reliable, people-first content | https://developers.google.com/search/docs/fundamentals/creating-helpful-content                                | Main heading or title should summarize the content; accurate bylines where readers expect them; no preferred word count; do not fake freshness                                                                                                                                                                                                                | title/H1 word overlap; machine-readable author on article-like pages; word count shown as information only | content quality, originality, visible bylines              | Google              |
| Google: General structured data guidelines               | https://developers.google.com/search/docs/appearance/structured-data/sd-policies                               | Markup must represent visible content; do not mark up invisible content                                                                                                                                                                                                                                                                                       | headline/name vs visible text; date contradictions; url vs canonical                                       | rich-result eligibility (not claimed)                      | Google rich results |
| Google: JavaScript SEO basics                            | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics                   | Google renders; not all bots run JavaScript; links need `<a href>`                                                                                                                                                                                                                                                                                            | M11.1 comparison result                                                                                    | how any crawler actually rendered the page                 | Google, general     |
| Bing: training and grounding preferences (2026-10-30)    | https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ | Grounding informs AI answers; preferences default to allow; take effect 2027-02-01                                                                                                                                                                                                                                                                            | shown in Crawler access (M11.6)                                                                            | whether Microsoft recrawled the page                       | Microsoft           |
| Bing Webmaster Guidelines                                | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a                                             | Not read: the page renders client-side and returned no body to the fetcher                                                                                                                                                                                                                                                                                    | —                                                                                                          | —                                                          | —                   |

No requirement for ChatGPT, Claude, Gemini, Perplexity, or Copilot content was found or invented. llms.txt is not checked: Google says AI text files are not needed, and no provider in the registry documents reading it.

### Decisions

- Information architecture: AI & Search keeps one navigation entry and gains two tabs, Crawler access and Content readiness. Visibility (M11.7) is not shown until it exists.
- No score. Each group reports checks completed, opportunities, not measured, and not applicable. The page score is unchanged (tested).
- Existing page checks are reused by id and shown with an "open in Issues" link; no rule is reimplemented.
- M11.1 and M11.6 results are read from an in-memory store for this report page (20 pages max). Readiness never starts a network request or asks for permission, and says "Not measured" with a button to run the existing check. A full reload of the report page clears the store.

## v0.7.1 integration log

Owner policy (2026-11-25): one local branch, `feature/v0.7.1-m11-integration` in `/home/ed/Projects/Rust/rankmiso-v071-integration`, created from the M11.5 head 6a51151 (develop 5d1bfa1 + M11.6 + M11.5). Remaining order: M11.3 → M11.2 → M11.4 → M11.7 → M11.8, then version 0.7.1 and one test package. No push or PR until the owner accepts the complete build. Cargo target is a symlink to `/tmp/rankmiso-m11-cargo` (tmpfs).

### M11.3 checkpoint

Done: Google-documented hreflang codes and fully-qualified alternates in `RULE_HREFLANG_INVALID`; crawl pages record hreflang; `site_relations` engine; Site Explorer Overview panel; shared `FindingList.vue` (also used by Content readiness). Tests: Rust 118 passed / 1 ignored; Vitest 248 passed / 4 skipped; `site-relations.spec.ts` passes in Chromium. Found: browser fetch cannot read redirect responses, so Site Explorer records redirected URLs as unreadable; relations treat them as not verified. Next: M11.2.

### M11.2 checkpoint

Done: optional `webRequest` permission (owner approved 2026-11-25) with `redirect-observer.ts`; hop-by-hop `redirect-trace.ts`; `seo-rules::redirects`; Technical → Redirect trace card; Site Explorer follows same-origin redirects when details are granted. Found and fixed: Chrome reports report-page requests with the tab's id, so RankMiso's own requests are matched by `initiator`/`originUrl`, not tab -1. Tests: Rust 125 passed / 1 ignored; Vitest 256 passed / 4 skipped; Playwright Chromium 14/14 including `redirects.spec.ts` (hops, loop, 404 destination, crawl canonical → redirect). Site Explorer heap median 20,390,083 bytes. Next: M11.4.

## M11.2 — redirect intelligence (plan)

Reuse: `html-fetch.ts` already follows same-origin redirects manually (5 hops, 8 s, 512 KB); `seo-rules::technical::{redirects, redirect_hops}` already grade the navigation's redirect count and probe hops.

1. **Collect (TypeScript).** A `RedirectTrace { schemaVersion: 1, start, hops: [{url, status, location, crossOrigin}], final: {url, status} | null, stopped: "loop" | "limit" | "blocked" | "network" | null, metaRefresh: {delay, url} | null }`. Follow up to 10 hops with `redirect: "manual"`. Cross-origin hops need the user to grant that origin. Without it, stop with `blocked` and record the location only. Re-check every hop against `isBlockedProbeHost` (private, loopback, link-local, metadata). Read `<meta http-equiv=refresh>` from the final HTML, within the existing 512 KB cap. Do not run page scripts. A JavaScript navigation is reported only when the browser saw it (navigation entry type or history), marked "observed in this browser", never "verified".
2. **Analyze (Rust, `seo-rules::redirects`).** Rules: `REDIRECT_LOOP` (error), `REDIRECT_CHAIN_LONG` (warning above 3 hops), `REDIRECT_TEMPORARY` (info for 302/307 on a page that also declares a canonical elsewhere), `REDIRECT_DOWNGRADE` (error, https→http), `REDIRECT_TO_ERROR` (error, final 4xx/5xx), `REDIRECT_CROSS_ORIGIN` (info), `REDIRECT_CANONICAL_MISMATCH` (warning, canonical points to a URL that redirects), `REDIRECT_META_REFRESH` (warning for delay 0 used as a redirect). Unchecked hops return `UNAVAILABLE`.
3. **UI.** Technical view, one card: hop list (status pill, URL, latency), findings in the same list style as M11.1.
4. **Tests.** Local HTTP fixture for 301, 302, 307, 308, loop, 11-hop chain, https→http, cross-origin denied, meta refresh, private-address target.

## M11.3 — canonical and hreflang intelligence (plan)

Reuse: `seo-rules::metadata` (canonical checks), `seo-rules::international` (hreflang syntax and return links for probed pages), Site Explorer page records (canonical, status, robots, indexability already stored per page).

- Page level (Rust, extend existing modules): multiple conflicting canonicals, relative canonical resolved and shown, canonical to a URL this session saw redirect (M11.2 trace) or fail, canonical to a page the crawl recorded as noindex, cross-domain canonical (info), hreflang language and region codes checked against ISO 639-1 and ISO 3166-1 alpha-2 tables compiled into Rust (no network), `x-default` handling, duplicate hreflang values.
- Site level (TypeScript aggregation in `site-analysis.ts`, rule text from Rust): canonical targets inside the crawl, canonical chains, canonical clusters, missing hreflang return links only when both pages were crawled. If a target was not crawled, the finding is "not verified in this crawl", never "missing".
- No new crawling. Snapshot schema stays 1, and new fields are optional.
- Tests: Rust tables for code validation, Site Explorer fixture with a three-language cluster, one missing return link, one canonical to a 404, and one canonical to a noindex page.

## M11.4 — structured data intelligence (plan)

Reuse: `seo-rules::structured_data`, `structured-markup.ts` (JSON-LD, Microdata, limited RDFa extraction), Schema view.

- Explicit support list, documented in `docs/features/structured-data.md`: Organization, WebSite, BreadcrumbList, Article/NewsArticle/BlogPosting, Product/Offer, FAQPage, LocalBusiness. Everything else is parsed and shown, but only syntax is checked.
- Rules: JSON syntax error with position, duplicate entity declarations (same `@type` and `@id` or same name+url), conflicting values across blocks (`name`, `url`, `logo` for one Organization), property type checks for the supported list (URL fields are absolute http(s), dates are ISO 8601, `price` numeric), `@id` references that resolve nowhere on the page, breadcrumb positions 1..n in order, Organization consistent with Open Graph `og:site_name`.
- Required-property checks only for the supported list, citing the Google Search Central page for each type with the date checked. Findings never say "eligible for rich results". The wording is "has the properties Google lists for X". FAQ results are restricted by Google to some sites; the finding says so.
- Tests: Rust fixture per type, one valid and one invalid each, plus conflict and reference cases.

## M11.5 — AIO/GEO content intelligence (original plan; implemented, see below and `docs/features/content-readiness.md`)

Goal: show whether content is accessible, crawlable, structured, attributed, and consistent. It does not predict AI citation or ranking.

### Diagnostics and their evidence

| Area          | Rule (Rust, `seo-rules::ai_readiness`)                   | Evidence it needs                                                                        | Already collected?                                             |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Structure     | One clear H1, heading order, a `main` landmark           | headings, landmark presence                                                              | Headings yes; landmark needs one boolean in the snapshot       |
| Structure     | Title, H1, and description describe the same topic       | text of each, term overlap (existing content metrics)                                    | Yes                                                            |
| Clarity       | Descriptive section headings (not "More", "Click here")  | heading texts                                                                            | Yes                                                            |
| Clarity       | Descriptive link text, image alt text                    | existing link and image rules                                                            | Yes, reuse as references                                       |
| Attribution   | Author, publisher, published and modified dates          | meta, JSON-LD (`author`, `publisher`, `datePublished`, `dateModified`), `article:*` meta | Mostly yes                                                     |
| Attribution   | Organization identity and contact                        | Organization JSON-LD, `contactPoint`, footer contact link                                | JSON-LD yes, footer heuristic no                               |
| Consistency   | Title / H1 / JSON-LD `headline` / `og:title` agree       | values above                                                                             | Yes                                                            |
| Consistency   | JSON-LD `url` or `@id` matches canonical                 | canonical, JSON-LD                                                                       | Yes                                                            |
| Accessibility | Content present in initial HTML                          | M11.1 result                                                                             | Only after the user runs a comparison, otherwise `UNAVAILABLE` |
| Accessibility | Not blocked by robots meta, X-Robots-Tag, or `nosnippet` | existing indexability data                                                               | Yes                                                            |

Applicability: attribution rules apply only to article-like pages (Article JSON-LD, `og:type=article`, or a byline element). A product page without an author is `NOT_APPLICABLE`, not a warning.

### Summary

No "AI ranking score". If owners want a number, it is **AI Content Readiness: X of Y checks met**, a plain count of applicable checks with no weights, with `UNAVAILABLE` and `NOT_APPLICABLE` excluded and listed beside it. The label always reads "Readiness checks, not a prediction of AI visibility."

### llms.txt

Informational only. When the user runs site checks, fetch `/llms.txt` once (same bounded fetch as robots.txt). Report present or absent and size, nothing else. Never a warning, never in the readiness count. The card states it is a proposal with no confirmed support from major search or AI platforms, and that Google says AI features in Search need no extra files. RankMiso never generates the file.

### UI and tests

A new report section "AI Readiness" under Site intelligence, with the same card and finding list pattern as Technical. Tests: Rust fixtures for article, product, home page, and a page with no headings; applicability tests so non-article pages never get attribution warnings.

## M11.6 — AI and search crawler accessibility (original plan; implemented, see `docs/features/crawler-access.md`)

### Registry research (official pages read 2026-11-25)

| Platform                                            | Token (robots.txt)                                              | Kind                   | Robots.txt behaviour stated                                                                                           | Effect of blocking, as stated                                                                        | Verification                                          | Support level                                           |
| --------------------------------------------------- | --------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Google Search                                       | `Googlebot`                                                     | search                 | "always obey robots.txt rules when crawling automatically"                                                            | Controls Search crawling. AI Overviews and AI Mode use the same Search index; no extra requirements. | IP JSON + reverse DNS `*.googlebot.com`               | verified                                                |
| Google (Gemini apps, Vertex AI grounding, training) | `Google-Extended` (control token, not a crawler)                | ai-training control    | n/a; Google states there is no separate Google-Extended crawler                                                       | "doesn't impact a site's inclusion in Google Search nor is it used as a ranking signal"              | n/a                                                   | verified                                                |
| Google other                                        | `GoogleOther`, `Google-CloudVertexBot`, `Google-InspectionTool` | other / user-requested | same as Googlebot                                                                                                     | GoogleOther "don't affect any specific product"; Vertex bot "no effect on Google Search"             | IP JSON                                               | verified                                                |
| ChatGPT search                                      | `OAI-SearchBot`                                                 | ai-search              | robots.txt control                                                                                                    | Opt-out: not shown in ChatGPT search answers, may still appear as navigational links; ~24 h to apply | `openai.com/searchbot.json`                           | verified                                                |
| OpenAI training                                     | `GPTBot`                                                        | ai-training            | robots.txt control                                                                                                    | Training only                                                                                        | `openai.com/gptbot.json`                              | verified                                                |
| ChatGPT user fetch                                  | `ChatGPT-User`                                                  | user-fetch             | "robots.txt rules may not apply"                                                                                      | Not used to decide search appearance                                                                 | `openai.com/chatgpt-user.json`                        | verified                                                |
| Claude training                                     | `ClaudeBot`                                                     | ai-training            | honours robots.txt, supports Crawl-delay                                                                              | Training                                                                                             | `claude.com/crawling/bots.json`                       | verified                                                |
| Claude search                                       | `Claude-SearchBot`                                              | ai-search              | honours robots.txt                                                                                                    | Blocking "may reduce" visibility in search results                                                   | same                                                  | verified                                                |
| Claude user fetch                                   | `Claude-User`                                                   | user-fetch             | honours robots.txt (no exception stated)                                                                              | Blocking "may reduce" visibility for user-directed search                                            | same                                                  | verified                                                |
| Perplexity search                                   | `PerplexityBot`                                                 | ai-search              | not stated                                                                                                            | Surfaces sites in Perplexity results; not used for model training                                    | `perplexity.ai/perplexitybot.json`                    | partial                                                 |
| Perplexity user fetch                               | `Perplexity-User`                                               | user-fetch             | "generally ignores robots.txt rules"                                                                                  | n/a                                                                                                  | `perplexity.ai/perplexity-user.json`                  | verified                                                |
| DuckDuckGo search                                   | `DuckDuckBot`                                                   | search                 | respects robotstxt.org rules                                                                                          | Not stated. DuckDuckGo also uses other result sources.                                               | `duckduckgo.com/duckduckbot.json`                     | partial                                                 |
| DuckDuckGo AI answers                               | `DuckAssistBot`                                                 | ai-search              | opt-out via robots.txt, applies after 72 h                                                                            | "does not impact organic search rankings"; not used for training                                     | `duckduckgo.com/duckassistbot.json`                   | verified                                                |
| Brave Search                                        | none ("does not advertise a differentiated user agent")         | search                 | robots.txt "is not used to prevent a page from being indexed"; use noindex; crawl limited to what Googlebot may crawl |                                                                                                      | none                                                  | informational: evaluate the Googlebot result and say so |
| Apple (Spotlight, Siri, Safari)                     | `Applebot`                                                      | search                 | respects robots.txt for Applebot-targeted crawls; ignores Crawl-delay                                                 | Allows content in Apple search results; data may also train Apple models                             | reverse DNS `*.applebot.apple.com` or `applebot.json` | verified                                                |
| Apple training control                              | `Applebot-Extended` (control token, does not crawl)             | ai-training control    | n/a                                                                                                                   | Pages that disallow it can still appear in search                                                    | n/a                                                   | verified                                                |
| Yandex                                              | `YandexBot` (main indexer)                                      | search                 | Yes (per table)                                                                                                       | not stated                                                                                           | reverse + forward DNS                                 | verified                                                |
| Yandex AI answers                                   | `YandexAdditional` / `YandexAdditionalBot`                      | ai-search control      | table says robots.txt "No"; used to process robots.txt rules that keep content out of Yandex AI responses             |                                                                                                      | reverse + forward DNS                                 | partial: wording needs a second read                    |
| Baidu                                               | `Baiduspider`                                                   | search                 | will not crawl, index, or show blocked pages, though they may appear via other sites' descriptions                    |                                                                                                      | not stated                                            | partial                                                 |
| Bing / Microsoft Copilot                            | `Bingbot` (expected)                                            | search                 | not verified: the Bing help page returned no body                                                                     | not verified                                                                                         | not verified                                          | **unknown until re-checked**                            |
| Yahoo Search                                        | none verified                                                   | search                 | not researched                                                                                                        |                                                                                                      |                                                       | unknown                                                 |
| Grok / xAI                                          | none verified                                                   |                        | not researched                                                                                                        |                                                                                                      |                                                       | not supported                                           |

Open questions before M11.6 starts:

1. Re-read Bing's crawler page in a real browser (it returned an empty body to the fetcher) and Microsoft's documentation for Copilot. Do not add a Copilot crawler unless Microsoft documents one.
2. Confirm Yahoo's current result source before listing it, or show it as "uses another provider's index (unverified)".
3. Second read of the Yandex table for `YandexAdditional`.
4. Anthropic's page gives no user-agent strings and only a relative update date. Record the page as read on 2026-11-25.
5. Google plans an AIPREF token `__usage_ai-training` in early 2027 (stated on the Google-Extended page). Track it; do not ship it early.

The registry lives in `apps/extension/src/config/crawlers.config.ts` as readonly data: `{ id, platformId, name, token, kind: "search" | "ai-search" | "ai-training-control" | "user-fetch", robotsBehaviour: "obeys" | "may-ignore" | "ignores" | "control-only" | "not-used" | "unknown", documentationUrl, reviewedOn, supportLevel }` plus `platforms: { id, name, crawlerIds }`. The same file drives the Rust call (tokens only) and the UI. A test fails if any entry lacks `documentationUrl` or `reviewedOn`.

### Engine

- Rust: generalize the existing `robots_decision_for(body, path, product)` in `technical.rs` into `pub fn robots_verdict(body, url_path, token) -> RobotsVerdict { matched_group, rule, allowed }`. It already handles groups, longest match, allow on ties, `*`, and `$`. To add for RFC 9309: exact case-insensitive product-token match (today it is a substring match), merging repeated groups for one agent, percent-encoding normalization of path and pattern, 500 KiB parse limit, and treating 4xx as "allow all" and 5xx or unreachable as "disallow all" per RFC 9309 §2.3.1.
- WASM: `crawler_access(input_json)` takes robots status and body, URL, meta robots, X-Robots-Tag, HTTP status, and token list; returns one verdict per token.
- TypeScript: reuse `site-probe.ts` for the one robots.txt fetch (already user-initiated, bounded, and SSRF-checked). No requests with spoofed user agents.

### Status model (shown words)

Allowed by robots.txt · Disallowed by robots.txt · No rule for this crawler · robots.txt unavailable (5xx: treated as disallow all) · robots.txt missing (allow all) · Page not reachable · Login required (401/403) · Rate limited (429) · Not tested · Not supported (platform has no documented crawler). Indexing directives (noindex, nosnippet, X-Robots-Tag) are a separate column. Never "crawled by", "indexed by", or "visible in".

## M11.7 — AI platform visibility and citations (plan)

Three measurements, never combined: **crawler access** (M11.6), **search visibility** (only with source and date, for example a future Search Console import), and **AI answer visibility** (observations below).

- Observation record: `{ id, queryId, platform, observedAt, method: "manual" | "pasted", domainMentioned: boolean | null, citations: [{ url, position | null, positionBasis: "listed order" | null }], answerExcerpt?: string (max 1,000 chars, user-entered), notes }`. Query record: `{ id, text, locale?, createdAt }`.
- Storage: `localStorage` key `rankmiso.aiVisibility`, schema 1, at most 50 queries and 20 observations per query per platform, 500 KB total, oldest dropped first with a visible notice. Export and import as JSON. Never uploaded.
- Collection: the user runs the query on the platform themselves (RankMiso opens the platform's own search URL in a new tab when one exists) and records or pastes what they saw. No scraping, no automated queries, no developer API keys. Official APIs are reviewed per platform later and only as an optional, user-keyed feature.
- Display: per query and platform, the latest result as Cited / Mentioned / Not seen in this sample / Not checked, with the date. History shows changes between samples. "Position" is shown only when the user recorded a listed order and is labelled "order in that answer". Never "ranked", never "not ranked anywhere".

## M11.8 — platform branding and UI (plan)

What the official pages say (read 2026-11-25; not legal advice):

- **Google:** plain-text references in an informational context are allowed. The logo may be used to refer to Google but not in marketing materials or to imply endorsement; it may not be modified, and Google's brand colours may not be used. Product icons (for example Gemini) need approval through the Partner Marketing Hub form.
- **OpenAI:** logo use needs permission or compliance with its marks terms (requests to partnercomms@openai.com). No modifying, no implied endorsement, and marks may not be more prominent than our own.
- **Microsoft (Bing, Copilot):** logos and icons need an express licence; truthful, unaltered text references are allowed.
- **Anthropic, Perplexity, DuckDuckGo, Brave:** no readable usage rules were found (Anthropic's press kit is a zip that was not opened; DuckDuckGo and Brave publish logo packages with guidelines inside zips that were not opened).
- **Simple Icons:** the project is CC0, but the disclaimer says individual icons are not necessarily CC0 and trademarks are not licensed. Each brand's own rules still apply.

Strategy:

1. Ship text names first: a neutral monogram tile (first letter, Miso tokens, no brand colour) plus the name. This needs no permission and meets the status-card design.
2. Store any approved logo as a local SVG in `apps/extension/public/platforms/`, with scripts and external references stripped and checked by a test, at most 4 KB each, and the source and permission recorded in `docs/branding/third-party-marks.md`.
3. Logos only appear beside factual status, never in store images, never recoloured, never larger than RankMiso's own mark.
4. Add a Settings line: "Product names and marks belong to their owners. RankMiso is not affiliated with them."

UI: one report section **AI & Search** under Site intelligence with three tabs (Crawler access, AI readiness, AI visibility), each with its own legend. The tabs make the three measurements look different.

## Proposed PR boundaries

1. `fix/marketing-compliance-v071` → `develop` (marketing only; owner may also want it on `master` for the store upload, through the normal promotion).
2. `feature/m11-v0.7.1-seo-intelligence` → `develop`: M11.1 code, tests, and these docs.
3. One PR per later milestone (M11.2 … M11.8), each after approval.
