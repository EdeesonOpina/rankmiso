# Canonical and hreflang intelligence (M11.3, unreleased)

## Page level (Issues, International)

`RULE_HREFLANG_INVALID` now follows Google's documented format (localized-versions page, read 2026-11-25): an ISO 639-1 language, optionally an ISO 15924 script (four letters; the shape is checked, not the registry) and an ISO 3166-1 alpha-2 region, or `x-default`; case-insensitive. Region-only values (`us`), numeric regions (`es-419`), reserved codes (`UK`, `EU`, `UN`), and unknown codes are reported with the reason. Alternates must be fully-qualified `http(s)://` URLs. The lists live in `crates/seo-rules/src/lang_codes.rs` (184 languages, 249 regions). This is the same scored rule as before, so only pages that are actually invalid under Google's rules change.

Existing canonical checks (missing, multiple, unusable URL, fragment or relative reference) are unchanged.

## Site level (Site Explorer → Overview → Canonical / Hreflang relationships)

Engine: `seo-rules::site_relations`, WASM `analyze_site_relations`, input schema 1, weight 0. Runs on the open crawl once it stops; nothing is fetched.

| Id                          | Finding                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| SITE_CANONICAL_COVERAGE     | how many pages declare a canonical, how many point elsewhere, how many targets were checked, and which were not verified |
| SITE_CANONICAL_TO_REDIRECT  | canonical target redirected in this crawl                                                                                |
| SITE_CANONICAL_TO_ERROR     | canonical target returned HTTP 4xx/5xx                                                                                   |
| SITE_CANONICAL_TO_NOINDEX   | canonical target says noindex                                                                                            |
| SITE_CANONICAL_CHAIN        | canonical target names a further canonical                                                                               |
| SITE_CANONICAL_CROSS_HOST   | canonical on another host (information; may be intended; never requested)                                                |
| SITE_HREFLANG_COVERAGE      | pages with hreflang, alternates checked, not verified, records saved before hreflang was collected                       |
| SITE_HREFLANG_RETURN        | alternate analyzed in this crawl does not link back                                                                      |
| SITE_HREFLANG_TARGET_STATUS | alternate redirected or failed                                                                                           |
| SITE_HREFLANG_NON_CANONICAL | alternate names a different canonical                                                                                    |
| SITE_HREFLANG_CONFLICT      | one value points to different URLs within a language group                                                               |
| SITE_HREFLANG_X_DEFAULT     | language group of two or more without x-default (information)                                                            |

Evidence rules: a relationship is judged only when the target was requested in this crawl and returned a status; otherwise it is listed as not verified. A return link is judged only when the target was analyzed and its alternates are known and not truncated. Unfinished crawls add a "partial crawl" note to every finding. URLs are compared after dropping fragments and default ports; trailing slashes are significant.

Google documents return links, self-listing, fully-qualified alternates, and a same-language canonical with hreflang. It does not document canonicals that point to redirects, errors, or noindex pages; those are reported as contradictions observed in the crawl.

Data: crawled pages now record up to 20 absolute hreflang alternates (`hreflang`, `hreflangTruncated`, optional). Older saved crawls lack them and show as not verified. Saved comparison snapshots do not keep them.

Limit found: Site Explorer cannot read redirect responses (browsers return an opaque response for `redirect: "manual"`), so redirected targets are currently not verified. M11.2 addresses this.
