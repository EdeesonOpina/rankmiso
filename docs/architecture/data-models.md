# Data models

Snapshot schema version: 1. Audit schema version: 1. Ruleset version: 1.0.0.

The snapshot carries the URL, titles, meta tags, rel links, headings, links, images, visible text with a 200,000 character cap, JSON-LD blocks, accessibility counts, performance observations, and navigation status when the browser provides it. LCP and CLS are browser timeline observations. INP is estimated from the browser's available event entries for the current session; these are not field measurements.

The audit carries the score, checks, recommendations, content metrics, classified links, and the interpreted metadata. It does not echo the full visible text.

Check status values are `PASS`, `WARNING`, `ERROR`, `INFO`, `NOT_APPLICABLE`, and `UNAVAILABLE`.

Rule ids are stable, for example `RULE_META_TITLE_MISSING` and `RULE_NOINDEX_DETECTED`. Each check also has a `titleKey` such as `rules.metaTitleMissing.title`.

Limits applied again inside Rust: 2,000 links, 500 images, 500 headings, 40 structured blocks, and 100,000 characters per block. Truncation adds a limitation code.
