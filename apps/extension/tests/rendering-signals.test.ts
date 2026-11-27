import { describe, expect, it } from "vitest";
import {
  parseHtml,
  renderSignalsFromAudit,
  renderSignalsFromDocument,
} from "../src/services/html-signals";

const url = "https://example.com/guide";

function fromHtml(html: string) {
  return renderSignalsFromDocument(parseHtml(html, url), url);
}

// Fixtures only. They describe sample pages, not real sites.
describe("rendering signals from the initial HTML", () => {
  it("reads static metadata, links, and JSON-LD types", () => {
    const signals = fromHtml(`<!doctype html><html><head>
      <title> Guide
      </title>
      <meta name="description" content="A guide">
      <meta name="robots" content="index, follow">
      <meta name="googlebot" content="max-snippet:50">
      <link rel="canonical" href="/guide#top">
      <script type="application/ld+json">{"@type":"https://schema.org/Article","author":{"@type":"Person"}}</script>
      <script type="application/ld+json">{not json</script>
    </head><body><h1>Guide</h1>
      <a href="/a">A</a><a href="https://other.org/">Out</a><a href="mailto:x@example.com">Mail</a>
    </body></html>`);
    expect(signals).toEqual({
      title: "Guide",
      description: "A guide",
      canonicals: ["/guide#top"],
      robots: ["index, follow", "max-snippet:50"],
      h1: ["Guide"],
      links: ["https://example.com/a", "https://other.org/"],
      linksTruncated: false,
      jsonLdTypes: ["Article", "Person"],
    });
  });

  it("reports an empty shell as empty, not as missing data", () => {
    const signals = fromHtml(
      `<!doctype html><html><head></head><body><div id="app"></div></body></html>`,
    );
    expect(signals.title).toBe("");
    expect(signals.canonicals).toEqual([]);
    expect(signals.h1).toEqual([]);
    expect(signals.links).toEqual([]);
    expect(signals.jsonLdTypes).toEqual([]);
  });

  it("caps link targets and says so", () => {
    const links = Array.from({ length: 2_005 }, (_, i) => `<a href="/p${i}">p</a>`).join("");
    const signals = fromHtml(`<html><body>${links}</body></html>`);
    expect(signals.links).toHaveLength(2_000);
    expect(signals.linksTruncated).toBe(true);
  });
});

describe("rendering signals from the audit", () => {
  it("uses resolved link URLs and the rendered metadata", () => {
    const signals = renderSignalsFromAudit({
      page: { title: "Guide  " },
      details: {
        metadata: {
          description: "A guide",
          canonicals: ["https://example.com/guide"],
          robots: ["noindex"],
          googlebot: ["nofollow"],
        },
        headings: [
          { level: 1, text: "Guide" },
          { level: 2, text: "Section" },
        ],
        links: [
          { href: "/a", resolvedUrl: "https://example.com/a" },
          { href: "javascript:void(0)", resolvedUrl: null },
          { href: "https://other.org/", resolvedUrl: null },
        ],
        structuredData: [
          { format: "json-ld", types: ["https://schema.org/Article"] },
          { format: "microdata", types: ["Product"] },
        ],
      },
      source: { limitations: ["LINKS_TRUNCATED"] },
    });
    expect(signals).toEqual({
      title: "Guide",
      description: "A guide",
      canonicals: ["https://example.com/guide"],
      robots: ["noindex", "nofollow"],
      h1: ["Guide"],
      links: ["https://example.com/a", "https://other.org/"],
      linksTruncated: true,
      jsonLdTypes: ["Article"],
    });
  });
});
