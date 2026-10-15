# Browser adapters

The current browser calls are small and live next to their use:

- `src/services/inspect.ts` queries the active tab and runs `runPageTool` through `scripting.executeScript`
- `src/adapters/storage.ts` reads and writes the theme preference, with `localStorage` as a test fallback
- Sidebar opening uses `browser.sidePanel` on Chromium and `browser.sidebarAction` on Firefox. The button is hidden when neither exists.
- Firefox receives `sidebar_action` from the side panel entry. Chromium receives `side_panel`
- `src/services/site-probe.ts` is the only optional network client. It runs after a user gesture and an origin permission, with timeouts, a redirect cap, a response-size cap, and a private-address block.

Navigation changes are marked by wrapping `pushState` and `replaceState` in the page main world after an analysis starts. The wrapper increments `data-seo-toolkit-generation`. The dashboard compares that value when the window regains focus. It does not poll.
