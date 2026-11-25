# JavaScript SEO diagnostics (M11.1, unreleased)

Where: full-page report → Technical → **HTML comparison**. It runs after the user chooses **Compare HTML** (Chromium only, needs site access) or **Compare an HTML file** (Chrome and Firefox).

## What is compared

RankMiso already has the rendered page as its audit. The initial HTML comes from a fresh fetch or from a file the user picks. The browser reads the same signals from both, and the Rust engine (`seo-rules::rendering`, WASM `analyze_rendering`, input schema 1) compares them:

| Rule id                  | Signal                                    | Normalization                                   |
| ------------------------ | ----------------------------------------- | ----------------------------------------------- |
| `RENDER_TITLE`           | document title                            | whitespace collapsed                            |
| `RENDER_DESCRIPTION`     | meta description                          | whitespace collapsed                            |
| `RENDER_CANONICAL`       | `link rel=canonical`                      | resolved against the page URL, fragment dropped |
| `RENDER_ROBOTS`          | `robots` and `googlebot` meta directives  | tokens, case-insensitive, order ignored         |
| `RENDER_H1`              | H1 texts (first 20)                       | whitespace collapsed                            |
| `RENDER_INTERNAL_LINKS`  | same-host `a[href]` targets (first 2,000) | resolved, fragment dropped                      |
| `RENDER_STRUCTURED_DATA` | JSON-LD `@type` values                    | `https://schema.org/X` read as `X`              |

Each rule returns one finding with the initial and rendered values as evidence, a reason, and what to check.

## How findings are graded

A difference is not automatically a defect. Grading follows published Google guidance where it exists:

- **Error:** the initial HTML says `noindex` and JavaScript removes it. Google may skip rendering such a page.
- **Warning:** title only after rendering; canonical added, removed, or changed; JavaScript adds `noindex`; H1 or JSON-LD types removed; every internal link exists only after rendering.
- **Note:** description, H1, or JSON-LD types added or changed; some internal links added or removed; other robots directive changes.
- **Passed:** same in both versions. **Not applicable:** absent from both.
- **Not measured:** the initial HTML could not be read (access denied, timeout, redirect off the origin, over 512 KB, not HTML, error status, cancelled). Every signal is then marked not measured. None is counted as passing.

## Limits

- These findings are not part of the page SEO score and are not saved or exported.
- The rendered side is what this browser produced. Search engines render on their own schedule and may see something else. RankMiso never claims what Google or another engine saw.
- A separate fetch can differ from the original navigation (cookies, cache, personalization). A file the user picks may be from another time.
- Site Explorer crawls read only fetched HTML, so crawl snapshots, comparisons, and exports are unchanged.
- Microdata and RDFa are still compared in the plain row list, not by these rules.
