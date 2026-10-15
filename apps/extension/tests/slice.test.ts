import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StatusBadge from "../src/components/StatusBadge.vue";
import { runPageTool } from "../src/extraction/page-tool";

describe("StatusBadge", () => {
  it("shows a text label for an error", () => {
    const wrapper = mount(StatusBadge, { props: { status: "ERROR" } });
    expect(wrapper.text()).toContain("Error");
  });
});

describe("page extraction", () => {
  it("collects rendered metadata, headings, and skips hidden text", () => {
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
    const snapshot = runPageTool("extract") as {
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
