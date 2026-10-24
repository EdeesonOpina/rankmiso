# Testing strategy

Rust unit tests cover missing titles, alt text, noindex wording, canonicals, heading order, CJK word counts, English stop words, JSON-LD errors, schema rejection, truncation, link classification, HTTP warnings, and score exclusion.

Vitest covers CSV formula prefixing, HTML escaping, DOM extraction, highlight cleanup, status badge text, popup summaries, share cards, readable JSON-LD, thousands separators, PageSpeed response parsing, report comparison storage, and optional site-probe behavior.

Playwright loads the built Chromium extension and verifies that its popup renders. It also checks the Firefox package id and bundled WASM asset. Build both with `pnpm --filter @rankmiso/extension build` and `pnpm --filter @rankmiso/extension build:firefox`, then run `pnpm --filter @rankmiso/extension test:browser`; install the Playwright Chromium runtime with `pnpm --filter @rankmiso/extension exec playwright install chromium` first. The Chromium test uses the regular browser channel because Playwright's headless-shell binary does not load extensions reliably. Firefox's published behavior still needs manual verification.

Not automated yet:

- Extension load in Firefox and Edge
- SPA history changes
- Keyboard walkthrough of the dashboard
- Performance benchmarks across supported browsers
- INP capture lifecycle and Event Timing interaction aggregation in a real browser; verify these manually with `docs/testing/manual-checklist.md`

Prefer fixtures over live sites. The extractor test builds its own document.
