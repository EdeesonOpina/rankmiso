import { describe, expect, it } from "vitest";
import { compareHtml, signalsFromAudit } from "../src/services/html-signals";

const rendered = signalsFromAudit({
  page: { url: "https://example.com/products", title: "Example Products", language: "en" },
  details: {
    metadata: {
      description: "Rendered description",
      canonicals: ["https://example.com/products"],
      robots: ["index", "follow"],
      googlebot: [],
      bingbot: [],
    },
    headings: [{ level: 1, text: "Products" }],
    links: [{ classification: "internal" }, { classification: "external" }],
    hreflang: [],
    structuredData: [
      { format: "json-ld", types: ["Article"], raw: '{"@type":"Article"}' },
      {
        format: "microdata",
        types: ["Product"],
        raw: '{"items":[{"@type":"Product"},{"@type":"Offer"}]}',
      },
    ],
  },
});

describe("HTML comparison", () => {
  it("labels a script-changed title as changed and does not invent link counts", () => {
    const rows = compareHtml(
      `<!doctype html><html lang="en"><head>
        <title>Example Website</title>
        <link rel="canonical" href="https://example.com/home">
        <meta name="robots" content="index, follow">
      </head><body>
        <h1>Home</h1>
        <a href="/about">About</a>
      </body></html>`,
      "https://example.com/products",
      rendered,
    );
    const row = (id: string) => rows.find((item) => item.id === id);
    expect(row("title")).toMatchObject({
      fetched: "Example Website",
      rendered: "Example Products",
      state: "changed",
    });
    expect(row("description")?.state).toBe("added");
    expect(row("canonical")?.state).toBe("changed");
    expect(row("robots")?.state).toBe("same");
    expect(row("h1Count")).toMatchObject({ fetched: "1", rendered: "1", state: "same" });
    expect(row("jsonLd")?.state).toBe("added");
    expect(row("microdata")?.fetched).toBe("0");
    expect(row("microdata")?.state).toBe("added");
  });

  it("keeps identical metadata same, including a zero H1", () => {
    const same = signalsFromAudit({
      page: { url: "https://example.com/plain", title: "Plain", language: "en" },
      details: {
        metadata: {
          description: null,
          canonicals: [],
          robots: [],
          googlebot: [],
          bingbot: [],
        },
        headings: [],
        links: [],
        hreflang: [],
        structuredData: [],
      },
    });
    const rows = compareHtml(
      "<!doctype html><html lang='en'><head><title>Plain</title></head><body></body></html>",
      "https://example.com/plain",
      same,
    );
    expect(rows.find((row) => row.id === "title")?.state).toBe("same");
    expect(rows.find((row) => row.id === "h1Count")?.state).toBe("same");
    expect(rows.find((row) => row.id === "description")?.state).toBe("same");
  });

  it("still reads a title from malformed markup", () => {
    const rows = compareHtml("<title>Kept</title><div>", "https://example.com/plain", rendered);
    expect(rows.find((row) => row.id === "title")?.fetched).toBe("Kept");
  });
});
