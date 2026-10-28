# Agent guide

## Mission

Build RankMiso, a free, open-source, cross-browser SEO extension in the Miso ecosystem. Rust owns SEO rules. TypeScript owns the browser. Vue renders the result. There is no backend, account, payment, or telemetry. The product name, tagline, and asset paths come from `apps/extension/src/config/brand.config.ts`. Colors and fonts come from `packages/design-tokens/src/tokens.css`.

The local website at `~/Projects/Next/misoecosystem.com` is the source for official logos and mascot art when it is available. Read it for those assets. Do not modify it, and do not make the extension build depend on it. RankMiso's interface is a white-first workbench. Visual changes have to change how a screen presents its data, not only colors and spacing. Do not restore the website's cream canvas, ivory cards, or coral outlines unless the maintainer asks.

## Architecture rules

- Browser DOM and extension APIs stay out of Rust.
- The page snapshot and audit result use schema version 1 and camelCase JSON.
- An unavailable or not-applicable check is excluded from the score. It is never a pass.
- Do not invent search volume, difficulty, traffic, backlinks, or indexation.
- Brand strings come from `apps/extension/src/config`.
- UI chrome strings live in `apps/extension/src/locales/en.ts`. Rule sentences are emitted by Rust with stable `titleKey` values.
- Optional network features must be explicit and must not be required for the core report.

## Commands

```bash
pnpm install
pnpm build:wasm
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
pnpm --filter @rankmiso/extension test
pnpm --filter @rankmiso/extension typecheck
pnpm --filter @rankmiso/extension build
pnpm --filter @rankmiso/extension build:firefox
```

`wasm-bindgen-cli` must be 0.2.100, matching the crate pin.

## Testing

Rust tests cover rules and scoring. Vitest covers extraction, highlighting cleanup, the status badge, export escaping, popup summaries, share cards, readable JSON-LD, and thousands separators. A browser install test is still manual. Firefox was loaded as a temporary add-on and checked by hand. See `docs/testing/manual-checklist.md`.

## File ownership

- `crates/seo-core`: serializable contracts
- `crates/seo-rules`: checks and content metrics
- `crates/seo-scoring`: the weighted score
- `crates/seo-wasm`: the JSON boundary
- `apps/extension/src/extraction/page-tool.ts`: in-page extraction and highlighting. It must stay free of imports because it is serialized into the page.
- `apps/extension/src/components`: presentation
- `packages/report-formats`: CSV and HTML export

Do not add empty crates for schema or content until those modules outgrow `seo-rules`.

## Security restrictions

- No remote code, `eval`, or `new Function`.
- No default host permission.
- Escape exported HTML. Prefix CSV formula characters.
- Do not render page HTML as HTML.
- Validate snapshot schema version before scoring.

## Definition of done

A feature is done when the engine produces a real result, the UI can show it, empty and error states exist, tests cover the behavior, and the docs do not describe it as more complete than it is.

## Development standards

Ponytail, full mode: make the smallest change that finishes the task, including the callers and tests it touches. Reuse the existing components, crates, and tokens. Prefer the platform and the standard library. Do not add a dependency for a few lines, and do not add an abstraction that has one caller. Do not treat simplicity as a reason to drop validation, error handling, security, or accessibility.

UI work keeps the Miso tokens in `packages/design-tokens/src/tokens.css`. When the UI/UX Pro Max and Web Interface Guidelines skills are installed, read and apply them. Do not install skills or run unreviewed installers. If a skill is missing, follow this file and say which skill was unavailable.

Keep the core audit local. Optional network stays explicit. Do not add a chart library for a bar, a second SEO rules engine, telemetry, a default host permission, or a hosted backend.

Run the commands in this file that the change can affect. Record the result you actually saw. Update `docs/development/progress.md` and `docs/development/handoff.md` when a milestone moves. Later milestones M2–M7 are constraints in `docs/development/implementation-plan.md`; do not start them while M1 is the assignment.

Do not commit, push, or publish a store package unless the maintainer asks.

## Resume order

1. Read this file.
2. Read `docs/development/progress.md`.
3. Read `docs/development/handoff.md`.
4. Read `docs/development/decisions.md`.
5. Run the tests above.
6. Continue the next task in the handoff.
