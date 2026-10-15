# Components

Shared components:

- `StatusBadge` prints the status name. Color repeats the name and does not replace it.
- `ScoreBlock` shows the number, the counts, and the disclaimer.
- `CheckTable` filters by status and search text, then shows the description, the fix, and the evidence.
- `AnalysisApp` is the dashboard, options page, and side panel.

The popup tabs are an underline row: Overview, JSON-LD, Headings, Links, Images, and Social. JSON-LD is shown as labeled fields, not a broken raw string. The images tab shows each picture in a horizontal row, with the alt text and the image address beside the thumbnail. A centered line tells the reader to open the full report for the rest. Copy buttons sit on titles, descriptions, canonicals, headings, links, image addresses, and JSON-LD. The check filter field includes a search icon. The refresh control keeps a fixed height so a long page title cannot stretch it.

Buttons are real actions: refresh, export, highlight, clear, copy, and theme selection. Export buttons ask for confirmation before a file is created. Counts use thousands separators. Sections that are not built are omitted from navigation rather than shown as empty controls.

Loading and error text use an `aria-live` region. Navigation uses `aria-current`.
