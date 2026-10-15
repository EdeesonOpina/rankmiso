# Security

## Supported versions

Security fixes apply to the current development line. There is no published release yet.

## Reporting a vulnerability

Open a private security advisory if this repository is on GitHub. Until a public remote exists, report the issue to the maintainers without posting exploit details in a public issue.

## Design boundaries

- The extension requests `storage`, `activeTab`, and `scripting`. Host access is optional and unused by the current analysis.
- The Rust engine accepts a JSON snapshot. It does not read the DOM, the network, or extension privileges.
- WebAssembly is bundled with the extension. The extension does not load remote code.
- Extension pages use `wasm-unsafe-eval` so the local module can compile. That is not permission to evaluate page scripts.
- Reports escape HTML and prefix CSV cells that could be interpreted as spreadsheet formulas.
- Extracted HTML is shown as text. The report does not assign page HTML to `innerHTML`.
- Messages and page tools do not expose extension APIs to the page. The history marker, when installed, only increments a counter on the document element.

## Known limits

The history marker wraps `pushState` and `replaceState` in the page's main world after you run an analysis. It calls the original methods. It does not grant the page access to the extension.
