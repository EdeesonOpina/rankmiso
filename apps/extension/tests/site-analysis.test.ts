import { describe, expect, it } from "vitest";
import process from "node:process";
import {
  analyzeSite,
  duplicateGroups,
  filterSiteIssues,
  siteAnalysisCsv,
  siteAnalysisJson,
  sortSiteIssues,
} from "../src/services/site-analysis";
import type { CrawlPage, CrawlSession } from "../src/services/site-crawl";

function page(url: string, overrides: Partial<CrawlPage> = {}): CrawlPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html",
    title: "Page",
    titleState: "present",
    description: "Description",
    descriptionState: "present",
    canonical: "",
    canonicalCount: 0,
    robots: "",
    h1Count: 1,
    analyzed: true,
    internalLinks: [],
    internalLinkDetails: [],
    internalLinksTruncated: false,
    externalLinks: 0,
    imageCount: 0,
    imagesMissingAlt: 0,
    structuredDataCount: 0,
    structuredDataTruncated: false,
    indexability: "unknown",
    issues: [],
    findings: [],
    error: "",
    skipped: "",
    redirectHops: [],
    fromSitemap: false,
    depth: 0,
    ...overrides,
  };
}

function session(pages: CrawlPage[], overrides: Partial<CrawlSession> = {}): CrawlSession {
  return {
    id: "1",
    startUrl: "https://example.test/",
    origin: "https://example.test",
    scope: "host",
    status: "complete",
    startedAt: "",
    finishedAt: "",
    partial: false,
    robots: "read",
    sitemap: "empty",
    sitemapUrls: 0,
    discoveredCount: pages.length,
    pageLimit: 100,
    depthLimit: 3,
    limitsReached: [],
    findingCatalog: [],
    pages,
    duplicates: [],
    orphans: [],
    note: "",
    ...overrides,
  };
}

describe("site-wide analysis", () => {
  it("handles empty and partial sessions without claiming full coverage", () => {
    expect(analyzeSite(session([])).summary.analyzed).toBe(0);
    const result = analyzeSite(
      session([page("https://example.test/a")], {
        partial: true,
        discoveredCount: 5,
        limitsReached: ["pages"],
      }),
    );
    expect(result.summary).toMatchObject({
      analyzed: 1,
      discovered: 5,
      unanalyzed: 4,
      partial: true,
      limitsReached: ["pages"],
    });
  });

  it("excludes unavailable pages from successful analysis and keeps missing separate", () => {
    const result = analyzeSite(
      session([
        page("https://example.test/a", {
          title: "",
          titleState: "empty",
          descriptionState: "missing",
          findings: [{ id: "r1", status: "UNAVAILABLE", evidence: [] }],
        }),
        page("https://example.test/b", { status: null, error: "fetch failed", analyzed: false }),
        page("https://example.test/c", {
          skipped: "robots disallow",
          status: null,
          analyzed: false,
        }),
      ]),
    );
    expect(result.summary).toMatchObject({
      analyzed: 1,
      failed: 1,
      skipped: 1,
      emptyTitles: 1,
      missingDescriptions: 1,
      unavailableFindings: 1,
    });
    expect(result.duplicates).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("groups Unicode-normalized duplicate metadata but excludes empty values", () => {
    const groups = duplicateGroups([
      page("https://example.test/a", { title: "  Cafe\u0301   Guide ", description: "A" }),
      page("https://example.test/b", { title: "café guide", description: "B" }),
      page("https://example.test/c", { title: "", description: "C" }),
      page("https://example.test/d", { title: "  ", description: "D" }),
    ]);
    expect(groups).toEqual([
      {
        kind: "title",
        value: "Café Guide",
        urls: ["https://example.test/a", "https://example.test/b"],
      },
    ]);
  });

  it("builds bounded crawl-only link relationships and distinguishes unknown targets", () => {
    const a = page("https://example.test/a", {
      internalLinks: [
        "https://example.test/b",
        "https://example.test/b",
        "https://example.test/missing",
        "https://outside.test/",
      ],
      internalLinkDetails: [
        { url: "https://example.test/b", rel: ["nofollow"], anchorText: "B", target: "" },
        { url: "https://example.test/b", rel: ["ugc"], anchorText: "B page", target: "_blank" },
        { url: "https://example.test/missing", rel: [], anchorText: "Not fetched", target: "" },
      ],
    });
    const b = page("https://example.test/b", { status: 404, analyzed: false });
    const result = analyzeSite(session([a, b]));
    expect(result.links.map(({ target, targetState }) => [target, targetState])).toEqual([
      ["https://example.test/b", "failed"],
      ["https://example.test/missing", "not-crawled"],
    ]);
    expect(result.links[0]?.rel).toEqual(["nofollow", "ugc"]);
    expect(result.links[0]?.incomingSources).toBe(1);
    expect(result.lowIncomingPages).toEqual([
      { url: "https://example.test/a", incomingSources: 0 },
    ]);
  });

  it("retains a redirect observation for a crawled internal target", () => {
    const result = analyzeSite(
      session([
        page("https://example.test/a", { internalLinks: ["https://example.test/old"] }),
        page("https://example.test/old", {
          finalUrl: "https://example.test/new",
          redirectHops: ["https://example.test/new"],
        }),
      ]),
    );
    expect(result.links[0]).toMatchObject({
      target: "https://example.test/old",
      targetState: "analyzed",
      redirectTo: "https://example.test/new",
    });
  });

  it("groups findings using rule metadata and supports URL search, category filter, and sorting", () => {
    const pages = [
      page("https://example.test/a", {
        findings: [{ id: "r1", status: "WARNING", evidence: [{ label: "Count", value: "2" }] }],
      }),
      page("https://example.test/b", { findings: [{ id: "r1", status: "ERROR", evidence: [] }] }),
    ];
    const result = analyzeSite(
      session(pages, {
        findingCatalog: [
          {
            id: "r1",
            category: "headings",
            title: "Heading issue",
            description: "Fix heading",
            recommendation: "Add one H1",
          },
        ],
      }),
    );
    expect(result.issues[0]).toMatchObject({
      id: "r1",
      category: "headings",
      affected: [{ url: "https://example.test/a" }, { url: "https://example.test/b" }],
    });
    expect(sortSiteIssues(result.issues, "severity")[0]?.statuses).toContain("ERROR");
    expect(filterSiteIssues(result.issues, "/b", "headings")).toHaveLength(1);
    expect(filterSiteIssues(result.issues, "Heading", "metadata")).toHaveLength(0);
    expect(filterSiteIssues(result.issues, "", "all", "error")).toHaveLength(1);
    expect(filterSiteIssues(result.issues, "", "all", "warning")).toHaveLength(1);
  });

  it("exports pages and derived issue, duplicate, and link records", () => {
    const current = session(
      [
        page("https://example.test/a", {
          title: "Shared",
          internalLinks: ["https://example.test/b"],
          internalLinkDetails: [
            { url: "https://example.test/b", rel: [], anchorText: "B", target: "" },
          ],
        }),
        page("https://example.test/b", { title: "Shared" }),
      ],
      { partial: true },
    );
    const csv = siteAnalysisCsv(current);
    expect(csv).toContain(
      '"recordType","url","finalUrl","status","title","description","canonical","robots","indexability","issues","skipped","error","internalLinks","relatedUrl"',
    );
    expect(csv).toContain('"duplicate",');
    expect(csv).toContain('"link",');
    expect(csv).toContain("linksTruncated");
    const json = JSON.parse(siteAnalysisJson(current)) as {
      schemaVersion: number;
      siteAnalysis: { summary: { partial: boolean } };
    };
    expect(json).toMatchObject({ schemaVersion: 1, siteAnalysis: { summary: { partial: true } } });
  });

  it.skipIf(process.env.RANKMISO_RUN_PERF !== "1")(
    "benchmarks aggregation for a 100 page / 20k link fixture",
    () => {
      const pages = Array.from({ length: 100 }, (_, index) =>
        page(`https://example.test/${index}`, {
          title: `Section ${index % 10}`,
          description: `Description ${index % 5}`,
          internalLinks: Array.from(
            { length: 200 },
            (_unused, link) => `https://example.test/${(index + link + 1) % 100}`,
          ),
          internalLinkDetails: [],
        }),
      );
      const fixture = session(pages, { discoveredCount: 100, partial: true });
      const durations: number[] = [];
      for (let index = 0; index < 5; index += 1) {
        const start = performance.now();
        expect(analyzeSite(fixture).summary.analyzed).toBe(100);
        durations.push(performance.now() - start);
      }
      durations.sort((a, b) => a - b);
      console.info(
        `Site aggregation 100 pages / 20k links: median=${durations[2]?.toFixed(2)}ms min=${durations[0]?.toFixed(2)}ms max=${durations[4]?.toFixed(2)}ms (n=5)`,
      );
    },
  );
});
