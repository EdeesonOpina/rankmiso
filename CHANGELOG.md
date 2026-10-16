# Changelog

## 0.1.0

First version prepared for Firefox. It has not been submitted.

- Local on-page analysis for the rendered page: metadata, headings, content counts, links, images, JSON-LD syntax, social tags, and a limited accessibility sample.
- Weighted checklist score that excludes checks which could not be evaluated.
- Popup, full report, options page, and a side panel or sidebar entry.
- JSON, CSV, and HTML export, plus browser print.
- Page highlighting that can be cleared.
- No accounts, telemetry, or required network services.
- Product name, tagline, and asset paths come from one brand configuration. The toolbar icon is the fox sticker.
- Optional site check, started by the user for one origin: response headers, robots.txt, the first listed sitemap, redirect hops, hreflang return links, and public links 20 at a time. Local and private addresses are skipped.
- JSON-LD field list for a few common types. It is not an official rich-result test.
- The Performance section shows the resource count for this page load. Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint stay Unavailable. PageSpeed Insights is not called.
- Firefox id is `rankmiso@rankmiso.extension`. Listing text and upload steps are in `docs/releases/firefox.md`.
- Refresh reads the current page after a domain change. The browser closes the original access, so the click asks for the new site.

Search rankings, traffic, backlinks, and index coverage are not measured.
