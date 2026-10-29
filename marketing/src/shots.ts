export type ShotLayout = "popup" | "report";

export interface Shot {
  file: string;
  headline: string;
  sub: string;
  layout: ShotLayout;
  capture: string;
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
];
