import { describe, expect, it } from "vitest";
import { collectMarkup } from "../src/services/structured-markup";

function read(html: string) {
  document.body.innerHTML = html;
  return collectMarkup(document);
}

describe("structured markup", () => {
  it("reads nested microdata and itemref", () => {
    const blocks = read(`
      <div itemscope itemtype="https://schema.org/Product" itemref="extra">
        <span itemprop="name">Local product</span>
        <div itemprop="brand" itemscope itemtype="https://schema.org/Brand">
          <span itemprop="name">Miso</span>
        </div>
      </div>
      <p id="extra"><span itemprop="sku">A1</span></p>
    `);
    const parsed = JSON.parse(blocks.find((block) => block.format === "microdata")?.raw || "{}");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]["@type"]).toBe("https://schema.org/Product");
    expect(parsed.items[0].properties.name).toEqual(["Local product"]);
    expect(parsed.items[0].properties.sku).toEqual(["A1"]);
    expect(parsed.items[0].properties.brand[0]["@type"]).toBe("https://schema.org/Brand");
    expect(
      parsed.items.filter((item: { "@type": string }) => item["@type"].includes("Brand")),
    ).toHaveLength(0);
  });

  it("reports a missing itemtype, a missing itemref, and a cycle", () => {
    const blocks = read(`
      <div id="loop" itemscope itemtype="https://schema.org/Thing" itemref="loop">
        <span itemprop="name">Loop</span>
      </div>
      <div itemscope itemref="missing"><span itemprop="name">Ada</span></div>
    `);
    const parsed = JSON.parse(blocks[0]?.raw || "{}");
    expect(parsed.limitations.join(" ")).toContain("no itemtype");
    expect(parsed.limitations.join(" ")).toContain("did not match");
    expect(parsed.limitations.join(" ")).toContain("cycle");
  });

  it("resolves an RDFa prefix and leaves rev unread", () => {
    document.body.innerHTML = `
      <div prefix="schema: https://schema.org/" typeof="schema:Person">
        <span property="schema:name">Ada</span>
        <span rev="schema:knows">ignored</span>
      </div>
    `;
    const blocks = collectMarkup(document);
    const parsed = JSON.parse(blocks.find((block) => block.format === "rdfa")?.raw || "{}");
    expect(parsed.items[0]["@type"]).toContain("https://schema.org/name".replace("name", "Person"));
    expect(parsed.items[0].properties["https://schema.org/name"]).toEqual(["Ada"]);
    expect(parsed.limitations.join(" ")).toContain("rev is not read");
  });

  it("does not merge two items that share a name", () => {
    const blocks = read(`
      <div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Ada</span></div>
      <div vocab="https://schema.org/" typeof="Person"><span property="name">Ada</span></div>
    `);
    expect(blocks.map((block) => block.format).sort()).toEqual(["microdata", "rdfa"]);
  });
});
