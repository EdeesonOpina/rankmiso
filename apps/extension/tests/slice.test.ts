import { describe, expect, it } from "vitest";
import { statusKey } from "../src/components/workbench/checks";
import { translate } from "../src/composables/useI18n";
import { runPageTool } from "../src/extraction/page-tool";
import { vi } from "vitest";

describe("status labels", () => {
  it("shows a text label for an error", () => {
    expect(translate(statusKey.ERROR)).toBe("Error");
  });
});

describe("page extraction", () => {
  it("estimates session INP from exposed interaction entries", async () => {
    const entries = [
      { duration: 100, interactionId: 1 },
      { duration: 150, interactionId: 1 },
      { duration: 120, interactionId: 2 },
    ] as Array<PerformanceEntry & { interactionId: number }>;
    vi.spyOn(performance, "getEntriesByType").mockImplementation((type) =>
      type === "event" ? entries : [],
    );

    const result = (await runPageTool("extract")) as {
      performance: { inpMs: number | null };
    };

    expect(result.performance.inpMs).toBe(150);
    vi.restoreAllMocks();
  });

  it("collects rendered metadata, headings, and skips hidden text", async () => {
    document.title = "Rendered title";
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <title>Raw title</title>
      <meta name="description" content="A description for the fixture page that is long enough.">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <h1>Visible heading</h1>
      <p>Visible paragraph about audits.</p>
      <p hidden>Hidden secret text</p>
      <a href="/about">About</a>
      <a href="https://other.example/docs" rel="nofollow">Docs</a>
      <img src="/cover.png" alt="Cover">
      <img src="/decor.png">
      <script type="application/ld+json">{"@type":"Article"}</script>
    `;
    const snapshot = (await runPageTool("extract")) as {
      titles: { rendered: string };
      headings: Array<{ level: number; text: string }>;
      content: { visibleText: string; htmlLang: string };
      links: Array<{ href: string; accessibleName: string }>;
      images: Array<{ altPresent: boolean }>;
      structuredData: Array<{ format: string; raw: string }>;
      schemaVersion: number;
    };
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.titles.rendered).toBe("Rendered title");
    expect(snapshot.headings[0]).toMatchObject({ level: 1, text: "Visible heading" });
    expect(snapshot.content.visibleText).toContain("Visible paragraph");
    expect(snapshot.content.visibleText).not.toContain("Hidden secret text");
    expect(snapshot.content.htmlLang).toBe("en");
    expect(snapshot.links.map((link) => link.accessibleName)).toEqual(["About", "Docs"]);
    expect(snapshot.images.map((image) => image.altPresent)).toEqual([true, false]);
    expect(snapshot.structuredData[0]?.format).toBe("json-ld");
  });

  it("clears highlights without leaving the style element", () => {
    document.body.innerHTML = `<h1>One</h1><a href="https://example.com/in">In</a>`;
    const highlighted = runPageTool("highlight", "headings") as { highlighted: number };
    expect(highlighted.highlighted).toBe(1);
    expect(document.getElementById("seo-toolkit-highlight")).not.toBeNull();
    runPageTool("clear");
    expect(document.querySelector("[data-seo-toolkit-mark]")).toBeNull();
    expect(document.getElementById("seo-toolkit-highlight")).toBeNull();
  });
});
