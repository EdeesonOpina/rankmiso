# Manual checklist

Use an unpacked build and a local HTML file, not only a production website.

- The popup Overview tab shows the page title, description, H1, canonical, robots, counts, and a score, or a clear error on `chrome://` and `about:` pages.
- A long page title truncates, and the refresh control stays one line.
- Primary buttons use readable foreground text against the theme primary color in light and dark modes. Card and table lines stay quiet in both themes.
- Counts of 1,000 or more show a comma.
- The JSON-LD tab shows labeled fields. Words are not split in the middle. Copy produces formatted JSON.
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
- Edit the metadata preview title and description; verify it changes only the preview and that **Restore page values** resets both fields.
- Save a PageSpeed API key, verify no request occurs until **Run mobile PageSpeed Insights** is pressed, and verify the permission prompt can be denied without sending the request.
- With Google access allowed and a valid key, verify PSI lab results appear separately from the local score; clear settings and confirm the key is removed.
- On a browser exposing Event Timing interaction IDs, start INP capture, close the popup, interact with the page, reopen or refresh the report, and verify the estimate updates. Stop capture and verify it ends; reload the page and verify capture does not persist across page loads. Verify unsupported browsers and pages with no qualifying interactions remain clearly unavailable.
- System, light, and dark appearance all keep text readable.
- The side panel opens on Chrome. On a browser without the API, the button is absent and the dashboard still works.
- In Firefox, verify the Technical section shows the local-only notice and has no optional site-check buttons; verify the Performance section has no PageSpeed key/request controls. Invoke RankMiso on a different page and confirm the extension can still read it through `activeTab` without an optional origin prompt.
