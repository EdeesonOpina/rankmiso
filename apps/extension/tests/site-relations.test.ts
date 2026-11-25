import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractCrawlPage } from "../src/services/site-extract";
import type { CrawlPage, CrawlSession } from "../src/services/site-crawl";

const harness = vi.hoisted(() => ({ inputs: [] as unknown[], response: "" }));
vi.mock("../src/wasm/pkg/seo_wasm.js", () => ({
  analyze_site_relations: (json: string) => {
    harness.inputs.push(JSON.parse(json));
    return harness.response;
  },
}));
vi.mock("../src/services/engine", () => ({ ensureEngine: () => Promise.resolve() }));

const { analyzeSiteRelations } = await import("../src/services/site-relations");
const { default: SiteRelationsPanel } =
  await import("../src/components/workbench/SiteRelationsPanel.vue");
enableAutoUnmount(afterEach);

const origin = "https://example.com";

function session(patch: Partial<CrawlSession> = {}, pages: CrawlPage[] = []): CrawlSession {
  return {
    id: "s1",
    startUrl: `${origin}/`,
    origin,
    scope: origin,
    status: "complete",
    startedAt: "2026-11-25T00:00:00Z",
    finishedAt: "2026-11-25T00:01:00Z",
    partial: false,
    robots: "read",
    sitemap: "not-read",
    sitemapUrls: 0,
    pages,
    duplicates: [],
    orphans: [],
    note: "",
    ...patch,
  };
}

describe("crawl extraction", () => {
  it("records absolute hreflang alternates, capped at 20", () => {
    const links = Array.from(
      { length: 22 },
      (_, i) => `<link rel="alternate" hreflang="l${i}" href="/p${i}">`,
    ).join("");
    const page = extractCrawlPage(
      `<html><head><link rel="Alternate" hreflang="en-GB" href="https://example.com/en#x">
       <link rel="alternate" href="/feed.xml">${links}</head></html>`,
      `${origin}/a`,
    );
    expect(page.hreflang?.[0]).toEqual({ lang: "en-GB", href: `${origin}/en` });
    expect(page.hreflang).toHaveLength(20);
    expect(page.hreflangTruncated).toBe(true);
    expect(page.hreflang?.some((item) => item.href.endsWith("feed.xml"))).toBe(false);
  });
});

describe("site relations service", () => {
  beforeEach(() => {
    harness.inputs.length = 0;
    harness.response = JSON.stringify({ schemaVersion: 1, findings: [] });
  });

  it("maps pages, keeps unknown hreflang as null, and marks unfinished crawls partial", async () => {
    const page = extractCrawlPage("<html></html>", `${origin}/`);
    const old = { ...page, url: `${origin}/old`, hreflang: undefined, status: 301 };
    await analyzeSiteRelations(session({ status: "stopped" }, [{ ...page, status: 200 }, old]));
    const input = harness.inputs[0] as {
      partial: boolean;
      pages: Array<{ hreflang: unknown; status: number | null; analyzed: boolean }>;
    };
    expect(input.partial).toBe(true);
    expect(input.pages[0]).toMatchObject({ status: 200, analyzed: true, hreflang: [] });
    expect(input.pages[1]!.hreflang).toBeNull();
  });
});

describe("relations panel", () => {
  beforeEach(() => {
    harness.inputs.length = 0;
  });

  it("waits for the crawl to stop, then lists canonical and hreflang findings", async () => {
    harness.response = JSON.stringify({
      schemaVersion: 1,
      findings: [
        {
          id: "SITE_CANONICAL_TO_REDIRECT",
          category: "technical",
          status: "WARNING",
          weight: 0,
          applicable: true,
          titleKey: "rules.siteCanonicalToRedirect.title",
          title: "Canonical points to a redirect",
          description: "Observed.",
          evidence: [{ label: "case", value: `${origin}/a → ${origin}/old → ${origin}/new` }],
          recommendation: "Point the canonical at the final URL.",
          references: [],
        },
        {
          id: "SITE_HREFLANG_COVERAGE",
          category: "technical",
          status: "NOT_APPLICABLE",
          weight: 0,
          applicable: false,
          titleKey: "rules.siteHreflangCoverage.title",
          title: "Hreflang relationships in this crawl",
          description: "No analyzed page declared hreflang alternates.",
          evidence: [],
          recommendation: null,
          references: [],
        },
      ],
    });
    const running = mount(SiteRelationsPanel, {
      props: { session: session({ status: "running" }) },
    });
    await flushPromises();
    expect(harness.inputs).toHaveLength(0);
    expect(running.text()).toContain("checked when the crawl stops");

    const done = mount(SiteRelationsPanel, { props: { session: session() } });
    await flushPromises();
    const panels = done.findAll(".sx-panel");
    expect(panels[0]!.text()).toContain("Canonical points to a redirect");
    expect(panels[0]!.text()).toContain("1 to review");
    expect(panels[0]!.find(".badge").text()).toBe("Review");
    expect(panels[1]!.text()).toContain("Not applicable");
  });

  it("says when the engine fails instead of showing results", async () => {
    harness.response = "nope";
    const wrapper = mount(SiteRelationsPanel, { props: { session: session() } });
    await flushPromises();
    expect(wrapper.text()).toContain("could not be checked");
  });
});
