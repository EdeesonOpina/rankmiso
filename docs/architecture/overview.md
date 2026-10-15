# Architecture

RankMiso keeps the browser and the rules apart. You open the extension, the page tool reads the rendered page, and Rust decides what the checks mean. Vue only draws the audit.

```text
page tool -> PageSnapshot JSON -> seo-wasm -> AuditResult JSON -> Vue
```

Rust does not touch the DOM. The page tool does not import extension modules, because the browser serializes it into the tab.

Contracts live in `crates/seo-core`. Rules live in `crates/seo-rules`. Scoring lives in `crates/seo-scoring`. Schema version 1 is required. A newer snapshot is rejected instead of being guessed.

See `wasm-boundary.md`, `scoring.md`, and `data-models.md`.
