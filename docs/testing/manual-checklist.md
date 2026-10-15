# Manual checklist

Use an unpacked build and a local HTML file, not only a production website.

- The popup Overview tab shows the page title, description, H1, canonical, robots, counts, and a score, or a clear error on `chrome://` and `about:` pages.
- A long page title truncates, and the refresh control stays one line.
- Selected buttons use white text on green in light mode, and near-black text on the lighter green in dark mode. Card and table lines stay quiet in both themes.
- Counts of 1,000 or more show a comma.
- The JSON-LD tab shows labeled fields. Words are not split in the middle. Copy produces formatted JSON.
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
- System, light, and dark appearance all keep text readable.
- The side panel opens on Chrome. On a browser without the API, the button is absent and the dashboard still works.
