# Architecture

RankMiso keeps the browser and the rules apart. You open the extension, the page tool reads the rendered page, and Rust decides what the checks mean. Vue only draws the audit.

```text
page tool -> PageSnapshot JSON -> seo-wasm -> AuditResult JSON -> Vue
```

Rust does not touch the DOM. The page tool does not import extension modules, because the browser serializes it into the tab.

Contracts live in `crates/seo-core`. Rules live in `crates/seo-rules`. Scoring lives in `crates/seo-scoring`. Schema version 1 is required. A newer snapshot is rejected instead of being guessed.

See `wasm-boundary.md`, `scoring.md`, and `data-models.md`.
# Local MCP companion

The standalone `rankmiso-mcp` Rust executable reads only JSON exports from an explicitly configured directory and serves read-only tools over MCP stdio. The same Rust crate builds a separate one-shot Native Messaging host binary for explicit browser audit sharing. It writes only schema-version-1 audit snapshots to the same configured directory; Native Messaging uses its own length-prefixed protocol and never enters the MCP handler. The extension requests `nativeMessaging` only as an optional permission and only from a user action. Neither process is a dependency of the Rust/WASM engine. See [the MCP guide](../mcp/README.md).
