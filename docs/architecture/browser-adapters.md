# Browser adapters

The current browser calls are small and live next to their use:

- `src/services/inspect.ts` queries the active tab and runs `runPageTool` through `scripting.executeScript`
- `src/adapters/storage.ts` reads and writes the theme preference, with `localStorage` as a test fallback
- Side panel opening checks `browser.sidePanel` and hides the action when the API is missing
- Firefox receives `sidebar_action` from the side panel entry. Chromium receives `side_panel`

There is no network adapter yet. When one is added, it should be the only place that fetches http(s) URLs, and it should enforce timeout, redirect limits, response size, and a private-address block.

Navigation changes are marked by wrapping `pushState` and `replaceState` in the page main world after an analysis starts. The wrapper increments `data-seo-toolkit-generation`. The dashboard compares that value when the window regains focus. It does not poll.
