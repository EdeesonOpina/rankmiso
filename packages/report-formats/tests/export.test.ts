import { describe, expect, it } from "vitest";
import { csvCell, renderHtmlReport, safeFilename, toCsv } from "../src/index";

describe("report formats", () => {
  it("prefixes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+cmd")).toBe(`"'+cmd"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@sum")).toBe(`"'@sum"`);
  });

  it("builds a csv with a trailing newline", () => {
    expect(toCsv(["status", "title"], [["PASS", "Title is present"]])).toBe(
      `"status","title"\n"PASS","Title is present"\n`,
    );
  });

  it("escapes html and omits executable markup", () => {
    const html = renderHtmlReport({
      title: "<script>alert(1)</script>",
      url: "https://example.com/?q=<bad>",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      version: "0.1.0",
      rulesetVersion: "1.0.0",
      score: "80",
      disclaimer: "Not a ranking score",
      rows: [{ status: "ERROR", title: "Title", description: "<img onerror=alert(1)>", evidence: "a&b" }],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).toContain("a&amp;b");
  });

  it("sanitizes filenames", () => {
    expect(safeFilename("https://Example.com/a b", "json")).toBe("https-example.com-a-b.json");
  });
});
