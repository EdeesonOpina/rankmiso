# Testing strategy

Rust unit tests cover missing titles, alt text, noindex wording, canonicals, heading order, CJK word counts, English stop words, JSON-LD errors, schema rejection, truncation, link classification, HTTP warnings, and score exclusion.

Vitest covers CSV formula prefixing, HTML escaping, DOM extraction, highlight cleanup, and the status badge text.

Not automated yet:

- Extension load in Chrome, Edge, and Firefox
- WASM initialization inside an extension page
- SPA history changes
- Keyboard walkthrough of the dashboard

Prefer fixtures over live sites. The extractor test builds its own document.
