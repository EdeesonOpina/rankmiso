# Implementation plan

## v0.2.0 — release preparation

The current release branch consolidates the completed report improvements, saved comparisons, editable snippet drafts, optional PageSpeed Insights lab results, optional technical probes, browser performance observations, and explicit page-scoped INP capture. Version 0.2.0 is being prepared for Chrome and Firefox builds; store submission and publication remain separate release actions.

## Phase 0 — Research

Status: documented in this repository.

- Competitor notes: `docs/research/competitor-feature-matrix.md`
- Browser limits: `docs/browser-support/compatibility.md`
- Risks and decisions: `docs/development/decisions.md`

## Phase 1 — Foundation

Status: in place for the vertical slice.

- pnpm workspace and Cargo workspace
- WXT extension with Vue 3, TypeScript, and Tailwind tokens
- Rust crates `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`
- Theme preference in extension storage
- GitHub Actions workflow for format, Clippy, tests, and browser builds

## Phase 2 — Core inspection

Status: first working path is implemented.

Page tool extracts a snapshot, Rust returns an audit, and the popup plus dashboard render it. Export writes JSON, CSV, and HTML.

Still incomplete inside this phase:

- Firefox and Edge extension installation automation
- Browser-based performance benchmarking

Dashboard field labels now go through `src/locales/en.ts`. The product identity is RankMiso. See `docs/branding/overview.md`.

## Phase 3 — Advanced inspection

Implemented in part: JSON-LD syntax and a local field list, social metadata, and opt-in technical probes for headers, redirects, robots.txt, the first listed sitemap, hreflang return links, and public link responses.

Still unbuilt: official rich-result eligibility, Microdata and RDFa extraction, a comprehensive raw-versus-rendered comparison, and a full crawl. Google Rich Results Test remains an external, user-initiated validation tool.

## Phase 4 — Research tools

Partially implemented. Reports save local comparison summaries, and the metadata section has an editable approximate desktop/mobile snippet preview. SERP location simulation, result-page extraction, and selector helpers remain unbuilt. Do not add proprietary metric substitutes.

## Phase 5 — Performance and hardening

Implemented in part: browser-observed LCP/CLS and an INP estimate where Event Timing data is exposed. Users can explicitly start page-scoped INP capture; capture runs in the inspected page while the popup is closed and ends when the page reloads or closes. Optional mobile PageSpeed Insights results require a user-provided API key and explicit Google access; they remain outside the local audit score.

Still unbuilt: broader cross-browser interaction measurement validation, automated runtime installation in Firefox and Edge, and a dedicated security review beyond the current export and permission choices.

## Phase 6 — Public release

Chrome Web Store and Firefox Add-ons releases are available. See `docs/releases` for listing and package maintenance notes.

## Phase 7 — MCP integration (planned; not implemented)

Goal: let a user-approved MCP client read RankMiso's real audit results without adding a hosted service, account, telemetry, or a second implementation of SEO rules.

The transport and browser bridge are undecided. Investigate a local stdio MCP companion and the least-privilege way to receive an explicitly requested audit from the extension. Do not assume an MCP process can inspect a browser tab or page DOM by itself. Keep page extraction and browser permissions in TypeScript; keep SEO rules and scoring in Rust. Do not add default host permissions or let an MCP request silently start a site probe, navigate a tab, or transmit page data remotely.

Proposed first read-only surface, subject to the architecture spike:

- `rankmiso.get_current_audit`: return the latest audit the user explicitly generated in the browser, with measured, unavailable, and not-applicable states preserved.
- `rankmiso.get_page_summary`: return a bounded summary of URL, score disclaimer, key metadata, findings, and measurement limitations.
- An optional resource for the stable audit schema and check definitions, versioned with the engine.

Do not expose arbitrary page text, saved report history, API keys, or unrestricted URLs in the first version. If fetching a fresh audit needs browser access, require an explicit browser action and origin permission before making the result available to MCP. MCP must not invent rankings, traffic, backlinks, search volume, index status, field data, or rich-result eligibility.

Acceptance before implementation:

- Choose and document the local transport, browser-to-MCP handoff, supported MCP clients, and disconnect/revocation behavior.
- Define typed tool inputs/outputs from schema-version-1 audit contracts and return actionable errors for no active audit, stale page, unsupported browser, and denied permission.
- Add tests for redaction, size limits, unavailable-check preservation, malformed messages, and origin/permission boundaries.
- Verify no page content leaves the machine unless the user separately configures the MCP client or another external service to receive it.
- Keep the core extension fully usable with MCP absent or disabled.

Initial spike deliverable: a threat model and a small transport prototype over fixture audits. Do not ship a browser bridge until its permission and trust boundaries are reviewed.

## Acceptance for the current slice

- `cargo test --workspace` passes
- Extension unit tests pass
- `vue-tsc` passes
- Chrome MV3 and Firefox MV3 builds emit a local `.wasm` asset
- The report distinguishes measured issues from checks that did not run
- Chrome MV3 and Firefox MV3 package versions are 0.2.0
- INP capture is explicit, remains page-scoped, and has start, running, unsupported, stop, and no-interactions states
- MCP remains documented as planned and is not represented as an available feature
