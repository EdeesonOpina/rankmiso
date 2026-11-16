export type ShotLayout = "popup" | "report" | "sidebar";

export interface Shot {
  file: string;
  headline: string;
  sub: string;
  layout: ShotLayout;
  capture: string;
  /** Shows a feature Firefox does not have, so it is left out of the Firefox and Safari sets. */
  chromiumOnly?: boolean;
}

export const sampleNote =
  "Local sample page. The numbers are RankMiso's own analysis, not a ranking.";

export const shots: readonly Shot[] = [
  {
    file: "01-see-your-website.png",
    headline: "See Your Website Clearly.",
    sub: "Instant SEO insights, right in your browser.",
    layout: "popup",
    capture: "popup-overview",
  },
  {
    file: "02-structured-data.png",
    headline: "Understand Your Structured Data.",
    sub: "Inspect JSON-LD without digging through source code.",
    layout: "popup",
    capture: "popup-schema",
  },
  {
    file: "03-headings.png",
    headline: "Every Heading. In Focus.",
    sub: "Explore your page hierarchy at a glance.",
    layout: "popup",
    capture: "popup-headings",
  },
  {
    file: "04-links.png",
    headline: "Spot What Matters.",
    sub: "Review the links on the page, grouped and ready to check.",
    layout: "report",
    capture: "report-links",
  },
  {
    file: "05-full-report.png",
    headline: "Go Beyond the Popup.",
    sub: "Explore detailed SEO insights in one workspace.",
    layout: "report",
    capture: "report-overview",
  },
  {
    file: "06-images.png",
    headline: "Check the Pictures.",
    sub: "See each image and whether its alt text is present.",
    layout: "popup",
    capture: "popup-images",
  },
  {
    file: "07-social.png",
    headline: "Preview the Share Card.",
    sub: "Approximate Facebook and X cards from the tags on this page.",
    layout: "popup",
    capture: "popup-social",
  },
  {
    file: "08-metadata.png",
    headline: "Read the Page Identity.",
    sub: "Title, description, and canonical, plus a local snippet preview.",
    layout: "popup",
    capture: "popup-metadata",
  },
  {
    file: "09-content.png",
    headline: "Measure the Visible Text.",
    sub: "Word count and repeated terms from this page. Not search volume.",
    layout: "popup",
    capture: "popup-content",
  },
  {
    file: "10-issues.png",
    headline: "Know What to Fix First.",
    sub: "Findings sorted by severity, each with the evidence behind it.",
    layout: "popup",
    capture: "popup-issues",
  },
  {
    file: "11-site-explorer.png",
    headline: "See the Site at a Glance.",
    sub: "Crawl a bounded set of same-origin pages and review the results locally.",
    layout: "report",
    capture: "site-overview",
  },
  {
    file: "26-site-crawl-controls.png",
    headline: "A Crawl You Control.",
    sub: "Start a same-origin crawl when you choose, then save it locally for comparison.",
    layout: "report",
    capture: "site-console",
  },
  {
    file: "22-site-issues.png",
    headline: "Find the Patterns Behind Issues.",
    sub: "Group SEO findings by rule, severity, and the pages they affect.",
    layout: "report",
    capture: "site-issues",
  },
  {
    file: "23-site-pages.png",
    headline: "Inspect Each Crawled Page.",
    sub: "Review page status, metadata, findings, and internal links.",
    layout: "report",
    capture: "site-pages",
  },
  {
    file: "24-site-links.png",
    headline: "Follow Internal Links.",
    sub: "Explore link sources and destinations found in this crawl.",
    layout: "report",
    capture: "site-links",
  },
  {
    file: "25-site-compare.png",
    headline: "Compare Saved Crawls.",
    sub: "Separate confirmed changes from incomplete or unseen page data.",
    layout: "report",
    capture: "site-compare",
  },
  {
    file: "12-history.png",
    headline: "Track Progress Over Time.",
    sub: "Save comparisons on this device and see what changed.",
    layout: "report",
    capture: "report-history",
  },
  {
    file: "13-sidebar.png",
    headline: "A Sidebar That Keeps Up.",
    sub: "Opt in to Automatic Checks and it reads each page you switch to.",
    layout: "sidebar",
    capture: "sidebar",
  },
  {
    file: "14-website-access.png",
    headline: "Your Websites. Your Call.",
    sub: "Choose Automatic Checks or allow sites one at a time. Revoke any time.",
    layout: "popup",
    capture: "popup-settings",
  },
  {
    file: "15-technical.png",
    headline: "Check the Technical Signals.",
    sub: "Robots, canonical, and redirects, plus an HTML comparison on request.",
    layout: "report",
    capture: "report-technical",
    chromiumOnly: true,
  },
  {
    file: "16-sitemaps.png",
    headline: "Read the Sitemap.",
    sub: "Find sitemap files and check the addresses they list.",
    layout: "report",
    capture: "report-sitemaps",
    chromiumOnly: true,
  },
  {
    file: "17-performance.png",
    headline: "See How the Page Loaded.",
    sub: "Browser-observed LCP and CLS for this visit. Not field data.",
    layout: "popup",
    capture: "popup-performance",
    chromiumOnly: true,
  },
  {
    file: "18-accessibility.png",
    headline: "Cover the Accessibility Basics.",
    sub: "Names, labels, and ids, checked on a sample of the page.",
    layout: "popup",
    capture: "popup-accessibility",
  },
  {
    file: "19-international.png",
    headline: "Check Language Targeting.",
    sub: "See the page language and every hreflang alternate.",
    layout: "popup",
    capture: "popup-international",
  },
  {
    file: "20-export.png",
    headline: "Take Your Report With You.",
    sub: "JSON, CSV, or HTML, prepared locally and saved only after you confirm.",
    layout: "popup",
    capture: "popup-export",
  },
  {
    file: "21-dark-mode.png",
    headline: "Site Explorer, Day or Night.",
    sub: "Review the same local crawl in a lower-light theme.",
    layout: "report",
    capture: "site-dark",
  },
];

export type SetId = "chrome" | "firefox" | "safari-macos";

/** The shots a store set lists. Chromium-only features stay out of the other sets. */
export function shotsFor(set: SetId): readonly Shot[] {
  return set === "chrome" ? shots : shots.filter((shot) => !shot.chromiumOnly);
}
