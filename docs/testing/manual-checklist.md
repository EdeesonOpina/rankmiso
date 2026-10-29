# Manual checklist

Use an unpacked build and a local HTML file, not only a production website.

- The popup Overview tab shows the page title, description, H1, canonical, robots, counts, and a score, or a clear error on `chrome://` and `about:` pages.
- A long page title truncates, and the refresh control stays one line.
- Primary buttons use readable foreground text against the theme primary color in light and dark modes. Card and table lines stay quiet in both themes.
- Counts of 1,000 or more show a comma.
- The Schema tab shows each JSON-LD block, a structured tree, and raw JSON. Copy source keeps the captured text. Invalid JSON shows the error and the source. Microdata and RDFa, when present, appear as their own groups and are not described as a rich-result test.
- The full report's Structured data section has a clearly labeled Google Rich Results Test action. It opens Google's official test in a new tab and does not claim RankMiso has validated eligibility.
- The Images tab shows a thumbnail, alt text, and the image address in one horizontal row. Extra images are described in a centered line that points to the full report.
- The Social tab shows a link card and an X card. A page with `og:image` displays that image. A page without one says the image is missing.
- The check filter field shows a search icon.
- Choosing an export shows Confirm and Cancel before a file downloads. Print is not offered.
- A page with no title shows an error, not a pass.
- An image without an alt attribute is an error. An image with `alt=""` is a note.
- Highlight headings, then clear highlights. The page outline returns to its previous look.
- Refresh after a client-side URL change shows the stale notice or a new result.
- JSON export downloads. A CSV cell beginning with `=` is prefixed.
- The HTML report contains no executable script from the page text.
- Save a report comparison, verify it survives reopening the report, compare it with the current page, then delete one and delete all.
- Save the same page twice and confirm the score chart shows both times, including two saves on the same day. Confirm a different URL is not drawn on that chart.
- Confirm a category that was not measured says “Not measured”, and an older save without category data says “Not recorded”.
- Edit the metadata preview title and description; verify it changes only the preview and that **Restore page values** resets both fields.
- Save a PageSpeed API key, verify no request occurs until **Run mobile PageSpeed Insights** is pressed, and verify the permission prompt can be denied without sending the request.
- With Google access allowed and a valid key, verify PSI lab results appear separately from the local score; clear settings and confirm the key is removed.
- On a browser exposing Event Timing interaction IDs, start INP capture, close the popup, interact with the page, reopen or refresh the report, and verify the estimate updates. Stop capture and verify it ends; reload the page and verify capture does not persist across page loads. Verify unsupported browsers and pages with no qualifying interactions remain clearly unavailable.
- System, light, and dark appearance all keep text readable.
- The side panel opens on Chrome. On a browser without the API, the button is absent and the dashboard still works.
- In Firefox, verify the Technical section shows the local-only notice and has no optional site-check buttons; verify the Performance section has no PageSpeed key/request controls. Invoke RankMiso on a different page and confirm the extension can still read it through `activeTab` without an optional origin prompt.
- In Firefox, open Site and confirm there is no Start crawl button and no request to another page.
- In Chromium, open Technical and confirm Compare HTML does nothing until you allow that origin. Confirm the result says the response was fetched separately and was not saved. In Firefox, confirm there is no Compare HTML button and that choosing an HTML file still compares it.
- Confirm Google index status stays Unknown, and that an hreflang URL on another host says the return link was not checked.
- In Chromium, deny the origin prompt on Start crawl and confirm the crawl does not start. Allow it on a local fixture, confirm Stop ends the crawl, and confirm closing the report does not continue it.
