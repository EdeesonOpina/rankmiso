# What RankMiso shows

Open the extension on a normal web page. RankMiso reads the rendered page, runs the local engine, and splits the result into a short popup and a full report.

## Popup

The popup is 420 pixels wide. An underline row switches between Overview, JSON-LD, Headings, Links, Images, and Social. The refresh control keeps one height when the title is long.

**Overview** shows the checklist score, title, description, word and heading counts, link and image counts, the first H1, canonical, robots, language, and schema types. The first errors and warnings sit under that summary. Copy is available for the URL, title, description, and canonical.

**JSON-LD** is a set of labeled fields, with space between the name and the value. Copy keeps the formatted source.

**Headings** lists the outline. Each heading can be copied.

**Links** samples internal, external, and nofollow addresses. A web address opens in a new tab.

**Images** shows a thumbnail, the name in bold, then the address underneath.

**Social** draws an approximate link card and an X card. The share image loads when the address resolves. The card says when a title, description, or image was borrowed from another tag.

## Full report

The dashboard repeats the score, lists priority findings, and shows the measurement limits from the snapshot. Opening the report from a popup tab selects the matching section.

Tables for links, repeated terms, and hreflang can be resized from the header edge. Empty sections use a short title and one sentence, instead of a bare line of text.

Exports for JSON, CSV, and HTML ask for confirmation before a file is created.

## The number on the score

Counts use thousands separators. The score summarizes checks that ran. The result says it is a local summary, and that search engines may rewrite titles and descriptions.
