# Third-party platform marks

RankMiso shows search and AI platforms' own logos beside their names in AI & Search, so each card can be recognised at a glance. The owner asked for this on 2026-11-25. Names and marks belong to their owners; RankMiso is not affiliated with them and does not claim endorsement.

## Rules in the product

- Files live in `apps/extension/public/platforms/` and ship inside the extension. They are never fetched from the web.
- The artwork is not changed. Only metadata (editor namespaces, comments, titles, fixed width and height) was removed. Single-colour Simple Icons paths are filled with the brand colour Simple Icons records.
- Dark themes invert the three black marks (Apple, OpenAI, Copilot) so they stay visible, as the owners' white variants would.
- Marks appear only next to a factual status, at 17–20 px, smaller than RankMiso's own mark. They are not used in store images, promo tiles, or marketing.
- `tests/platform-marks.test.ts` checks that every file is a static SVG under 10 KB, with no script, `foreignObject`, image, link, event handler, or external reference.
- A platform without a file (Yahoo) shows its first letter.

## Sources (downloaded 2026-11-25)

| File             | Platforms                                      | Source                                                        | SHA-256 of the source file (first 16) |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `google.svg`     | Google Search, Google AI Overviews and AI Mode | Wikimedia Commons, `Google "G" logo.svg`                      | `ed9087d76cdc6d1c`                    |
| `gemini.svg`     | Gemini apps                                    | Wikimedia Commons, `Google Gemini icon 2025.svg`              | `cda2df6631d5fa22`                    |
| `bing.svg`       | Microsoft Bing                                 | Wikimedia Commons, `Bing Fluent Logo.svg`                     | `ff0f5b38b23fcf9b`                    |
| `copilot.svg`    | Microsoft Copilot                              | Wikimedia Commons, `Microsoft 365 Copilot Icon one-color.svg` | `8fec0ada78b4ff96`                    |
| `brave.svg`      | Brave Search                                   | Wikimedia Commons, `Brave lion icon.svg`                      | `41b5844c210771d0`                    |
| `yandex.svg`     | Yandex                                         | Wikimedia Commons, `Yandex icon.svg`                          | `11351f21ef674609`                    |
| `openai.svg`     | ChatGPT search                                 | Wikimedia Commons, `OpenAI logo 2025 (symbol).svg`            | `ca35a5723163b6a7`                    |
| `duckduckgo.svg` | DuckDuckGo, DuckDuckGo AI-assisted answers     | Simple Icons 16.38.1, `duckduckgo`, `#DE5833`                 | `82648474f6ddd359`                    |
| `apple.svg`      | Apple (Spotlight, Siri, Safari)                | Simple Icons 16.38.1, `apple`, `#000000`                      | `2a1509dccd25e6d2`                    |
| `baidu.svg`      | Baidu                                          | Simple Icons 16.38.1, `baidu`, `#2932E1`                      | `e2eeaca4c5273ecf`                    |
| `claude.svg`     | Claude                                         | Simple Icons 16.38.1, `claude`, `#D97757`                     | `2d6fda79eb18ddcc`                    |
| `perplexity.svg` | Perplexity                                     | Simple Icons 16.38.1, `perplexity`, `#1FB8CD`                 | `57220c29378ce5e6`                    |

Simple Icons is CC0, but its disclaimer says individual icons are not necessarily CC0 and trademarks are not licensed. Wikimedia Commons hosts these logos as trademarks, not as freely licensed works. Neither source grants permission to use the marks.

## What the owners say (from the M11.8 plan, read 2026-11-25; not legal advice)

- **Google:** the logo may be used to refer to Google in an informational context, not in marketing or to imply endorsement, and must not be modified. Product icons such as Gemini need approval through the Partner Marketing Hub.
- **OpenAI:** logo use needs permission (partnercomms@openai.com) or compliance with its brand terms; no modification, no implied endorsement, never more prominent than our own mark.
- **Microsoft (Bing, Copilot):** logos and icons need an express licence. Text references are allowed.
- **Anthropic, Perplexity, DuckDuckGo, Brave, Apple, Yandex, Baidu:** usage rules were not reviewed.

Simple Icons removed the OpenAI, Microsoft, Yahoo and Yandex marks at those owners' request, which shows the owners enforce their marks.

## Open item for the owner

Before a store release, decide per brand whether to keep the logo, request permission (Google Partner Marketing Hub for Gemini, OpenAI, Microsoft), or return that brand to its letter tile. To return a brand to its letter tile, delete its entry in `src/config/platform-marks.config.ts` and its file. Nothing else changes.
