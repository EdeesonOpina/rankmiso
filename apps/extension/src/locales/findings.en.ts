export interface FindingGuide {
  verify: string;
  example?: string;
}

/**
 * Presentation only. Detection stays in Rust. An example is generic markup,
 * not a description of the current page and not a ranking promise.
 */
export const findingGuides: Record<string, FindingGuide> = {
  RULE_META_TITLE_MISSING: {
    verify: "Confirm the rendered page has one non-empty title element.",
    example: "<title>What this page is about</title>",
  },
  RULE_META_TITLE_LENGTH: {
    verify:
      "Read the character count in Metadata. The range is editorial, not a ranking threshold.",
    example: "<title>A specific page title</title>",
  },
  RULE_DUPLICATE_TITLE: {
    verify: "View source and keep a single title element.",
  },
  RULE_META_DESCRIPTION_MISSING: {
    verify: "Look for one meta description in the metadata section.",
    example: '<meta name="description" content="A short summary of this page.">',
  },
  RULE_META_DESCRIPTION_LENGTH: {
    verify: "Read the character count. Search engines may still rewrite the snippet.",
    example: '<meta name="description" content="One or two sentences about this page.">',
  },
  RULE_DUPLICATE_META_DESCRIPTION: {
    verify: "Leave a single meta description.",
  },
  RULE_NOINDEX_DETECTED: {
    verify: "Read the robots directives. This is not proof that a search engine dropped the page.",
    example: '<meta name="robots" content="index,follow">',
  },
  RULE_ROBOTS_CONFLICT: {
    verify: "Compare robots, googlebot, and bingbot values and keep one clear instruction.",
  },
  RULE_VIEWPORT_MISSING: {
    verify: "Check for a viewport meta tag before judging mobile layout.",
    example: '<meta name="viewport" content="width=device-width, initial-scale=1">',
  },
  RULE_CHARSET_MISSING: {
    verify: "Confirm a character encoding is declared.",
    example: '<meta charset="utf-8">',
  },
  RULE_CANONICAL_MISSING: {
    verify: "Check the canonical row. A missing tag is not the same as an index decision.",
    example: '<link rel="canonical" href="https://example.com/page">',
  },
  RULE_CANONICAL_MULTIPLE: {
    verify: "Keep one canonical link.",
  },
  RULE_CANONICAL_INVALID: {
    verify: "Open the canonical address and confirm it is an absolute http(s) URL.",
  },
  RULE_META_REFRESH: {
    verify: "Find the meta refresh tag. Prefer a server redirect when a move is intentional.",
  },
  RULE_H1_MISSING: {
    verify: "Read the heading outline and add one H1 that describes the page.",
    example: "<h1>Page topic</h1>",
  },
  RULE_MULTIPLE_H1: {
    verify: "Count H1 elements in the heading outline.",
    example: "<h1>Page topic</h1>",
  },
  RULE_HEADING_EMPTY: {
    verify: "Find headings with no text in the outline.",
  },
  RULE_HEADING_LEVEL_SKIP: {
    verify: "Read the outline from H1 downward and close skipped levels.",
    example: "<h1>Topic</h1>\n<h2>Section</h2>",
  },
  RULE_HEADING_DUPLICATE: {
    verify: "Compare repeated heading text in the outline.",
  },
  RULE_CONTENT_THIN: {
    verify: "Read the word count. A low count is not a traffic or ranking estimate.",
  },
  RULE_IMAGE_ALT_MISSING: {
    verify: "Open Images and find entries marked as missing alt.",
    example: '<img src="/photo.jpg" alt="What the photo shows">',
  },
  RULE_IMAGE_ALT_EMPTY: {
    verify: "Empty alt is recorded as a note. Use it only when the image is decorative.",
    example: '<img src="/decoration.svg" alt="">',
  },
  RULE_IMAGE_BROKEN: {
    verify: "Open the image address from the Images table.",
  },
  RULE_LINK_EMPTY_ANCHOR: {
    verify: "Find links whose accessible name is empty.",
    example: '<a href="/guide">Read the guide</a>',
  },
  RULE_LINK_MIXED_CONTENT: {
    verify: "Find http:// links on this https:// page.",
  },
  RULE_LANG_MISSING: {
    verify: "Check the language row.",
    example: '<html lang="en">',
  },
  RULE_HREFLANG_INVALID: {
    verify: "Read the hreflang table. Invalid language shape is an error.",
    example: '<link rel="alternate" hreflang="en" href="https://example.com/">',
  },
  RULE_HREFLANG_DUPLICATE: {
    verify: "Look for repeated language codes in the hreflang table.",
  },
  RULE_HREFLANG_SELF: {
    verify: "Confirm one alternate points at this page when hreflang is used.",
  },
  RULE_JSONLD_SYNTAX: {
    verify: "Open Structured data. Invalid JSON is an error. It is not a rich-result verdict.",
  },
  RULE_SCHEMA_RICH_RESULTS: {
    verify:
      "Use the Google Rich Results test linked in Structured data. This row is not eligibility.",
  },
  RULE_OG_TITLE_MISSING: {
    verify: "Read the share card. A missing title may be filled from another tag.",
    example: '<meta property="og:title" content="Page title">',
  },
  RULE_OG_DESCRIPTION_MISSING: {
    verify: "Read the share card description source.",
    example: '<meta property="og:description" content="Page summary">',
  },
  RULE_OG_IMAGE_MISSING: {
    verify: "Confirm a share image address that resolves.",
    example: '<meta property="og:image" content="https://example.com/card.jpg">',
  },
  RULE_TWITTER_CARD_MISSING: {
    verify: "Check whether an X card type is declared.",
    example: '<meta name="twitter:card" content="summary_large_image">',
  },
  RULE_HTTPS_MISSING: {
    verify: "Read the page address. This check uses the URL, not a certificate scan.",
  },
  RULE_INDEXING_STATUS: {
    verify: "Index coverage is not measured. A robots tag is not an index report.",
  },
  RULE_A11Y_SAMPLE: {
    verify: "Treat accessibility rows as a sample, not a conformance audit.",
  },
  RULE_FORM_LABEL_MISSING: {
    verify: "Find controls named in the accessibility sample and add a label.",
  },
  RULE_BUTTON_NAME_MISSING: {
    verify: "Find buttons with no accessible name.",
  },
  RULE_DUPLICATE_ID: {
    verify: "Search the page for the repeated id.",
  },
  SITEMAP_XML_INVALID: {
    verify: "Open the file and fix the XML error named in the evidence.",
    example: "<urlset><url><loc>https://example.com/page</loc></url></urlset>",
  },
  SITEMAP_DTD: {
    verify: "Remove the DOCTYPE. RankMiso does not load external entities.",
  },
  SITEMAP_UNSUPPORTED: {
    verify: "Confirm the root element is urlset or sitemapindex.",
  },
  SITEMAP_NESTED_INDEX: {
    verify: "Point the index at sitemap files. RankMiso does not follow an index inside an index.",
  },
  SITEMAP_LOC_MISSING: {
    verify: "Give the url entry one absolute loc.",
  },
  SITEMAP_LOC_RELATIVE: {
    verify: "Replace the relative loc with an absolute http(s) URL.",
    example: "<loc>https://example.com/page</loc>",
  },
  SITEMAP_DUPLICATE_URL: {
    verify: "Search the processed files for the repeated loc.",
  },
  SITEMAP_LASTMOD: {
    verify: "Use a W3C date, or remove lastmod. This is not an indexing date.",
  },
  SITEMAP_LIMIT: {
    verify: "The counts stop where the safety limit stopped the read.",
  },
  RULE_CANONICAL_OBSERVATION: {
    verify:
      "Open the canonical row. A fragment or a relative URL is a preference problem, not Google's selected canonical.",
    example: '<link rel="canonical" href="https://example.com/page">',
  },
  RULE_IMAGE_DISPLAY: {
    verify: "Compare intrinsic and displayed width on the image row. File size is not measured.",
  },
  RULE_MICRODATA_EXTRACTED: {
    verify: "Open Microdata in Structured Data. Extraction is not rich-result eligibility.",
  },
  RULE_RDFA_EXTRACTED: {
    verify: "Open RDFa in Structured Data. rev and datatype coercion are not read.",
  },
};

export function findingGuide(id: string): FindingGuide | null {
  return findingGuides[id] ?? null;
}
