import { describe, expect, it } from "vitest";
import process from "node:process";
import { mount } from "@vue/test-utils";
import {
  sessionCsv,
  boundSession,
  type CrawlPage,
  type CrawlSession,
} from "../src/services/site-crawl";
import { siteAnalysisCsv } from "../src/services/site-analysis";
import {
  comparisonApplies,
  comparisonCsv,
  comparisonJson,
  compareSessions,
  compareSnapshots,
  filterComparedIssues,
  type SiteComparison,
} from "../src/services/site-compare";
import { readHistory, saveSnapshot, type CrawlSnapshot } from "../src/services/site-history";
import SiteComparePanel from "../src/components/workbench/SiteComparePanel.vue";

const origin = "https://example.test";

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
    robots: "",
    h1Count: 1,
    analyzed: true,
    internalLinks: [],
    internalLinkDetails: [],
    internalLinksTruncated: false,
    externalLinks: 0,
    indexability: "unknown",
    issues: [],
    findings: [],
    error: "",
    skipped: "",
    redirectHops: [],
    fromSitemap: false,
    depth: 1,
    ...overrides,
  };
}

function session(pages: CrawlPage[], overrides: Partial<CrawlSession> = {}): CrawlSession {
  return {
    id: "crawl",
    startUrl: `${origin}/`,
    origin,
    scope: "host",
    status: "complete",
    startedAt: "2026-11-01T00:00:00.000Z",
    finishedAt: "2026-11-01T00:01:00.000Z",
    partial: false,
    robots: "read",
    sitemap: "empty",
    sitemapUrls: 0,
    discoveredCount: pages.length,
    pageLimit: 100,
    depthLimit: 3,
    limitsReached: [],
    findingCatalog: [
      {
        id: "RULE_META_DESCRIPTION_MISSING",
        category: "metadata",
        title: "Missing meta description",
        description: "The page has no meta description.",
        recommendation: "Add one.",
      },
      {
        id: "RULE_IMAGE_ALT",
        category: "images",
        title: "Image missing alt",
        description: "An image has no alt text.",
        recommendation: null,
      },
    ],
    pages,
    duplicates: [],
    orphans: [],
    note: "",
    ...overrides,
  };
}

function finding(id: string, evidence = "body"): CrawlPage["findings"] {
  return [{ id, status: "WARNING", evidence: [{ label: "where", value: evidence }] }];
}

function snapshot(crawl: CrawlSession, rulesetVersion = "1.0.0"): CrawlSnapshot {
  return {
    schemaVersion: 1,
    id: "snap-1",
    origin: crawl.origin,
    savedAt: "2026-11-01T00:00:00.000Z",
    rankmisoVersion: "0.6.0",
    rulesetVersion,
    linksBounded: false,
    session: crawl,
  };
}

describe("crawl comparison", () => {
  it("hides a comparison when the selected crawls change", () => {
    expect(comparisonApplies("saved", "live", "crawl-a", "saved", "live", "crawl-a")).toBe(true);
    expect(comparisonApplies("saved", "live", "crawl-a", "live", "saved", "crawl-a")).toBe(false);
    expect(comparisonApplies("saved", "live", "crawl-a", "saved", "live", "crawl-b")).toBe(false);
  });

  it("reports no issue changes for identical crawls", () => {
    const crawl = session([
      page(`${origin}/about`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
    ]);
    const result = compareSessions(crawl, structuredClone(crawl));
    expect(result.counts).toMatchObject({
      newIssues: 0,
      resolvedIssues: 0,
      unchangedIssues: 1,
      notComparableIssues: 0,
    });
    expect(result.pages[0]?.status).toBe("unchanged");
  });

  it("classifies new, resolved, and unchanged issues on pages analyzed both times", () => {
    const previous = session([
      page(`${origin}/about`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
      page(`${origin}/contact`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
    ]);
    const current = session([
      page(`${origin}/about`, { findings: [] }),
      page(`${origin}/contact`, {
        findings: [
          ...(finding("RULE_META_DESCRIPTION_MISSING") ?? []),
          ...(finding("RULE_IMAGE_ALT", "hero") ?? []),
        ],
      }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.issues.map((issue) => [issue.page, issue.ruleId, issue.change])).toEqual([
      [`${origin}/contact`, "RULE_IMAGE_ALT", "new"],
      [`${origin}/about`, "RULE_META_DESCRIPTION_MISSING", "resolved"],
      [`${origin}/contact`, "RULE_META_DESCRIPTION_MISSING", "unchanged"],
    ]);
  });

  it("does not call an issue resolved when the current crawl missed the page", () => {
    const previous = session([
      page(`${origin}/about`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
      page(`${origin}/`),
    ]);
    const current = session([page(`${origin}/`)], { partial: true, status: "stopped" });
    const result = compareSessions(previous, current);
    expect(result.counts.resolvedIssues).toBe(0);
    expect(result.issues[0]).toMatchObject({
      page: `${origin}/about`,
      change: "not-comparable",
      reason: "page-not-in-current",
    });
    expect(result.pages.find((item) => item.page === `${origin}/about`)).toMatchObject({
      coverage: "not-observed",
      status: "not-comparable",
    });
    expect(result.limitations.partial).toBe(true);
  });

  it("does not treat a page missing from a partial crawl as deleted, or a newly seen page's issues as confirmed new", () => {
    const previous = session([page(`${origin}/about`, { findings: finding("RULE_IMAGE_ALT") })]);
    const current = session(
      [page(`${origin}/services`, { findings: finding("RULE_META_DESCRIPTION_MISSING") })],
      { partial: true },
    );
    const result = compareSessions(previous, current);
    expect(result.counts).toMatchObject({
      newIssues: 0,
      resolvedIssues: 0,
      notComparableIssues: 2,
    });
    expect(result.coverage).toMatchObject({ newlyObserved: 1, notObserved: 1, sharedPages: 0 });
  });

  it("keeps legacy crawls without finding ids out of resolved and new counts", () => {
    const previous = session([
      page(`${origin}/about`, { findings: undefined, issues: ["Missing meta description"] }),
    ]);
    const current = session([
      page(`${origin}/about`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.counts).toMatchObject({
      newIssues: 0,
      resolvedIssues: 0,
      notComparableIssues: 1,
    });
    expect(result.issues[0]?.reason).toBe("missing-findings");
    expect(result.limitations.missingFindings).toBe(true);
  });

  it("detects metadata changes without treating them as an improvement", () => {
    const previous = session([
      page(`${origin}/services`, { title: "Services", canonical: `${origin}/services` }),
    ]);
    const current = session([
      page(`${origin}/services`, {
        title: "Web Development Services | Example",
        canonical: `${origin}/services`,
        robots: "noindex",
        indexability: "noindex",
        h1Count: 2,
      }),
    ]);
    const result = compareSessions(previous, current);
    const row = result.pages[0];
    expect(row?.status).toBe("changed");
    expect(row?.fields.find((item) => item.field === "title")).toMatchObject({
      previous: "Services",
      current: "Web Development Services | Example",
      changed: true,
    });
    expect(row?.fields.find((item) => item.field === "robots")?.changed).toBe(true);
    expect(row?.fields.find((item) => item.field === "h1Count")?.changed).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/improved|ranking|traffic/i);
  });

  it("reports duplicate metadata changes and leaves uncovered groups unverified", () => {
    const previous = session([
      page(`${origin}/a`, { title: "Alpha" }),
      page(`${origin}/b`, { title: "Beta" }),
      page(`${origin}/c`, { title: "Shared" }),
    ]);
    const current = session([
      page(`${origin}/a`, { title: "Shared" }),
      page(`${origin}/b`, { title: "Shared" }),
      page(`${origin}/d`, { title: "Shared" }),
    ]);
    const covered = session([
      page(`${origin}/a`, { title: "Alpha" }),
      page(`${origin}/b`, { title: "Beta" }),
    ]);
    const matched = session([
      page(`${origin}/a`, { title: "Shared" }),
      page(`${origin}/b`, { title: "Shared" }),
    ]);
    const confirmed = compareSessions(covered, matched).duplicates.find(
      (group) => group.change === "new",
    );
    expect(confirmed?.currentUrls).toEqual([`${origin}/a`, `${origin}/b`]);
    const result = compareSessions(previous, current);
    expect(result.duplicates.some((group) => group.reason === "coverage")).toBe(true);
    expect(result.pages.find((item) => item.page === `${origin}/a`)?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "duplicateTitle", previous: "no", current: "yes" }),
      ]),
    );
  });

  it("counts a redirected alias once and keeps query-string variants distinct", () => {
    const previous = session([
      page(`${origin}/old`, { finalUrl: `${origin}/new`, title: "New" }),
      page(`${origin}/new`, { title: "New", findings: finding("RULE_IMAGE_ALT", "one") }),
      page(`${origin}/dup?v=1`, { title: "One" }),
      page(`${origin}/dup?v=2`, { title: "Two" }),
    ]);
    const current = session([
      page(`${origin}/new`, { title: "New", findings: finding("RULE_IMAGE_ALT", "one") }),
      page(`${origin}/dup?v=1`, { title: "One changed" }),
      page(`${origin}/dup?v=2`, { title: "Two" }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.coverage.previousAnalyzed).toBe(3);
    expect(result.counts.unchangedIssues).toBe(1);
    expect(result.pages.map((item) => item.page)).toEqual([
      `${origin}/dup?v=1`,
      `${origin}/dup?v=2`,
      `${origin}/new`,
    ]);
    expect(result.pages.find((item) => item.page === `${origin}/dup?v=1`)?.status).toBe("changed");
  });

  it("keeps repeated findings of one rule distinct when the evidence differs", () => {
    const crawl = session([
      page(`${origin}/gallery`, {
        findings: [
          { id: "RULE_IMAGE_ALT", status: "WARNING", evidence: [{ label: "src", value: "a.png" }] },
          { id: "RULE_IMAGE_ALT", status: "WARNING", evidence: [{ label: "src", value: "b.png" }] },
        ],
      }),
    ]);
    const later = session([
      page(`${origin}/gallery`, {
        findings: [
          { id: "RULE_IMAGE_ALT", status: "WARNING", evidence: [{ label: "src", value: "a.png" }] },
        ],
      }),
    ]);
    const result = compareSessions(crawl, later);
    expect(result.counts).toMatchObject({ resolvedIssues: 1, unchangedIssues: 1 });
  });

  it("confirms added and removed links only for pages analyzed both times", () => {
    const previous = session([
      page(`${origin}/`, { internalLinks: [`${origin}/a`, `${origin}/b`] }),
      page(`${origin}/a`),
      page(`${origin}/b`),
    ]);
    const current = session([
      page(`${origin}/`, { internalLinks: [`${origin}/a`, `${origin}/c`] }),
      page(`${origin}/a`),
      page(`${origin}/b`, { status: 404, error: "missing", analyzed: false, findings: undefined }),
      page(`${origin}/c`),
    ]);
    const result = compareSessions(previous, current);
    expect(result.links.map((link) => [link.change, link.target])).toEqual([
      ["added", `${origin}/c`],
      ["removed", `${origin}/b`],
    ]);
    expect(result.pages.find((item) => item.page === `${origin}/a`)?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "incomingSources", previous: "1", current: "1" }),
      ]),
    );
    expect(result.pages.find((item) => item.page === `${origin}/`)?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "incomingSources", previous: "0", current: "0" }),
      ]),
    );
  });

  it("does not report truncated link lists as removed links", () => {
    const previous = session([
      page(`${origin}/`, {
        internalLinks: [`${origin}/a`],
        internalLinksTruncated: true,
      }),
      page(`${origin}/a`),
    ]);
    const current = session([page(`${origin}/`, { internalLinks: [] }), page(`${origin}/a`)]);
    const result = compareSessions(previous, current);
    expect(result.counts.removedLinks).toBe(0);
    expect(result.counts).toMatchObject({
      linkPagesChanged: 0,
      linkPagesUnchanged: 1,
      linkPagesNotComparable: 1,
    });
    expect(result.links[0]).toMatchObject({
      change: "not-comparable",
      reason: "source-links-incomplete",
    });
  });

  it("reports a changed link target state and redirect destination", () => {
    const previous = session([
      page(`${origin}/`, { internalLinks: [`${origin}/old`] }),
      page(`${origin}/old`, { finalUrl: `${origin}/new` }),
      page(`${origin}/new`),
    ]);
    const current = session([
      page(`${origin}/`, { internalLinks: [`${origin}/old`] }),
      page(`${origin}/old`, { status: 404, error: "gone", analyzed: false }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.links.find((link) => link.target === `${origin}/old`)).toMatchObject({
      change: "changed",
      previousRedirect: `${origin}/new`,
      currentState: "failed",
    });
  });

  it("rejects a different origin, schema, or ruleset", () => {
    const left = session([page(`${origin}/`)]);
    const right = session([page("https://other.test/")], { origin: "https://other.test" });
    expect(compareSessions(left, right).comparable).toBe(false);
    expect(compareSessions(left, right).reason).toBe("origin");
    const base = snapshot(left);
    expect(
      compareSnapshots(base, { ...snapshot(session([page(`${origin}/`)])), schemaVersion: 2 as 1 })
        .reason,
    ).toBe("schema");
    expect(compareSnapshots(base, snapshot(session([page(`${origin}/`)]), "9.9.9")).reason).toBe(
      "ruleset",
    );
  });

  it("filters issues and writes formula-safe versioned exports without changing older exports", () => {
    const crawl = session([
      page(`${origin}/about`, {
        title: "=HYPERLINK()",
        findings: finding("RULE_META_DESCRIPTION_MISSING"),
      }),
      page(`${origin}/contact`, { findings: finding("RULE_IMAGE_ALT", "hero") }),
    ]);
    const result = compareSessions(
      crawl,
      session([
        page(`${origin}/about`, { title: "About", findings: [] }),
        page(`${origin}/contact`, { findings: finding("RULE_IMAGE_ALT", "hero") }),
      ]),
    );
    const filtered = filterComparedIssues(result.issues, {
      status: "resolved",
      severity: "warning",
      category: "metadata",
      rule: "DESCRIPTION",
      page: "/about",
    });
    expect(filtered).toHaveLength(1);
    const csv = comparisonCsv(result);
    expect(csv.split("\n")[0]).toBe(
      '"schemaVersion","recordType","change","reason","page","ruleId","category","severity","field","previous","current","detail"',
    );
    expect(csv).toContain("rankmiso.siteComparison");
    expect(csv).toContain(`"'=HYPERLINK()"`);
    const json = JSON.parse(comparisonJson(result)) as SiteComparison;
    expect(json).toMatchObject({
      schemaVersion: 1,
      kind: "rankmiso.siteComparison",
      comparable: true,
    });
    expect(sessionCsv(crawl).split("\n")[0]).toBe(
      '"url","finalUrl","status","title","description","canonical","robots","indexability","issues","skipped","error","internalLinks"',
    );
    expect(siteAnalysisCsv(crawl).split("\n")[0]?.split(",")).toHaveLength(22);
  });

  it("keeps changed evidence on the same rule from looking resolved", () => {
    const previous = session([
      page(`${origin}/about-us/`, {
        findings: [
          {
            id: "RULE_CANONICAL_MULTIPLE",
            status: "WARNING",
            evidence: [
              { label: "canonical", value: "https://example.test/a" },
              { label: "canonical", value: "https://example.test/b" },
            ],
          },
        ],
      }),
    ]);
    const current = session([
      page(`${origin}/about-us/`, {
        findings: [
          {
            id: "RULE_CANONICAL_MULTIPLE",
            status: "WARNING",
            evidence: [
              { label: "canonical", value: "https://example.test/a" },
              { label: "canonical", value: "https://example.test/c" },
            ],
          },
        ],
      }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.counts).toMatchObject({
      newIssues: 0,
      resolvedIssues: 0,
      unchangedIssues: 1,
    });
    expect(result.issues[0]).toMatchObject({
      change: "unchanged",
      evidenceChanged: true,
      reason: "evidence-changed",
    });
  });

  it("does not confirm a count change when stored evidence was shortened", () => {
    const previous = session([
      page(`${origin}/gallery`, {
        findings: [
          { id: "RULE_IMAGE_ALT", status: "WARNING", evidence: [{ label: "src", value: "a.png" }] },
          { id: "RULE_IMAGE_ALT", status: "WARNING", evidence: [{ label: "src", value: "b.png" }] },
        ],
      }),
    ]);
    const current = session([
      page(`${origin}/gallery`, {
        findings: [
          {
            id: "RULE_IMAGE_ALT",
            status: "WARNING",
            evidence: [{ label: "src", value: "shortened" }],
            evidenceTruncated: true,
          },
        ],
      }),
    ]);
    const result = compareSessions(previous, current);
    expect(result.counts.newIssues).toBe(0);
    expect(result.counts.resolvedIssues).toBe(0);
    expect(result.issues.some((issue) => issue.reason === "truncated-evidence")).toBe(true);
  });

  it("matches issues after a JSON round trip, reordered keys, and reordered evidence", () => {
    const crawl = session([
      page(`${origin}/about`, {
        findings: [
          {
            id: "RULE_IMAGE_ALT",
            status: "WARNING",
            evidence: [
              { label: "src", value: "b.png" },
              { label: "src", value: "a.png" },
            ],
          },
        ],
      }),
    ]);
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return [...value].reverse().map(reorder);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => right.localeCompare(left))
            .map(([key, item]) => [key, reorder(item)]),
        );
      }
      return value;
    };
    const restored = JSON.parse(JSON.stringify(reorder(crawl))) as CrawlSession;
    const result = compareSessions(crawl, restored);
    expect(result.counts).toMatchObject({ newIssues: 0, resolvedIssues: 0, unchangedIssues: 1 });
    const spaced = session([
      page(`${origin}/about`, {
        findings: [
          {
            id: "RULE_IMAGE_ALT",
            status: "WARNING",
            evidence: [
              { label: "src", value: "a.png " },
              { label: "src", value: "b.png" },
            ],
          },
        ],
      }),
    ]);
    const whitespace = compareSessions(crawl, spaced);
    expect(whitespace.counts).toMatchObject({
      newIssues: 0,
      resolvedIssues: 0,
      unchangedIssues: 1,
    });
    expect(whitespace.issues[0]?.evidenceChanged).toBe(true);
  });

  it("does not invent changes after saving and restoring a 75-page crawl", () => {
    localStorage.clear();
    const pages = Array.from({ length: 75 }, (_, index) =>
      page(`${origin}/p/${index}`, {
        title: index === 0 ? "T".repeat(600) : `Title ${index}`,
        description: "D".repeat(400),
        internalLinks: Array.from({ length: 80 }, (_unused, link) => `${origin}/p/${link}`),
        findings: [
          {
            id: "RULE_CANONICAL_MULTIPLE",
            status: "WARNING",
            evidence: [
              { label: "canonical", value: `${origin}/a-${index}` },
              { label: "canonical", value: `${"c".repeat(180)}-${index}` },
            ],
          },
          {
            id: "RULE_H1_MULTIPLE",
            status: "WARNING",
            evidence: [{ label: "H1 count", value: `2 extra ${"h".repeat(140)}` }],
          },
          {
            id: "RULE_IMAGE_ALT",
            status: "WARNING",
            evidence: [{ label: "src", value: `${"i".repeat(160)}-${index}.png` }],
          },
          {
            id: "RULE_META_DESCRIPTION_MISSING",
            status: "WARNING",
            evidence: [{ label: "where", value: "head" }],
          },
        ],
      }),
    );
    const crawl = session(pages, { partial: true, status: "stopped", id: "smdc-like" });
    const rawBytes = JSON.stringify(crawl).length;
    const saved = saveSnapshot(crawl, "0.6.0", "1.0.0", crawl.startedAt);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const storedBytes = (localStorage.getItem("rankmiso.siteCrawlHistory") ?? "").length;
    expect(storedBytes).toBeLessThan(rawBytes);
    const restored = readHistory().snapshots[0]?.session;
    expect(restored).toBeTruthy();
    if (!restored) return;
    expect(restored.pages.every((item) => item.internalLinks.length === 80)).toBe(true);
    expect(restored.pages.every((item) => item.internalLinksTruncated !== true)).toBe(true);
    expect(restored.pages[1]?.internalLinks[0]).toBe(`${origin}/p/0`);
    expect(
      restored.pages.some((item) => item.findings?.some((finding) => finding.evidenceTruncated)),
    ).toBe(false);
    expect(restored.pages.some((item) => item.titleTruncated)).toBe(true);
    const result = compareSessions(restored, crawl);
    expect(result.coverage).toMatchObject({
      previousAnalyzed: 75,
      currentAnalyzed: 75,
      newlyObserved: 0,
      notObserved: 0,
    });
    expect(result.counts.newIssues).toBe(0);
    expect(result.counts.resolvedIssues).toBe(0);
    expect(result.counts.unchangedIssues).toBeGreaterThan(0);
    expect(result.counts.addedLinks).toBe(0);
    expect(result.counts.removedLinks).toBe(0);
    expect(result.counts.changedLinks).toBe(0);
    expect(result.counts).toMatchObject({
      linkPagesChanged: 0,
      linkPagesUnchanged: 75,
      linkPagesNotComparable: 0,
    });
    expect(result.pages.some((item) => item.status === "changed")).toBe(false);
    expect(result.sameSession).toBe(true);
    console.info(
      `75-page snapshot raw=${rawBytes} stored=${storedBytes} linksRetained=${75 * 80} linkPagesNotComparable=0`,
    );
    localStorage.clear();
  });

  it("keeps a real link change and does not invent one from a saved copy", () => {
    localStorage.clear();
    const baseline = session([
      page(`${origin}/a`, { internalLinks: [`${origin}/b`] }),
      page(`${origin}/b`),
      page(`${origin}/c`),
    ]);
    const saved = saveSnapshot(baseline, "0.6.0", "1.0.0");
    expect(saved.ok).toBe(true);
    const restored = readHistory().snapshots[0]?.session;
    expect(restored?.pages[0]?.internalLinks).toEqual([`${origin}/b`]);
    const same = compareSessions(restored ?? baseline, baseline);
    expect(same.counts).toMatchObject({
      addedLinks: 0,
      removedLinks: 0,
      linkPagesNotComparable: 0,
    });
    const later = session([
      page(`${origin}/a`, { internalLinks: [`${origin}/c`] }),
      page(`${origin}/b`),
      page(`${origin}/c`),
    ]);
    const changed = compareSessions(restored ?? baseline, later);
    expect(changed.links.map((link) => [link.change, link.target])).toEqual([
      ["added", `${origin}/c`],
      ["removed", `${origin}/b`],
    ]);
    localStorage.clear();
  });

  it("does not report removed links when a list still has to be cut to fit", () => {
    localStorage.clear();
    const links = Array.from(
      { length: 200 },
      (_unused, link) => `${origin}/p/${"q".repeat(180)}-${link}`,
    );
    const crawl = session(
      Array.from({ length: 100 }, (_, index) =>
        page(`${origin}/p/${index}`, { internalLinks: links }),
      ),
    );
    const saved = saveSnapshot(crawl, "0.6.0", "1.0.0");
    expect(saved.ok).toBe(true);
    const restored = readHistory().snapshots[0]?.session;
    expect(restored).toBeTruthy();
    if (!restored) return;
    const retained = restored.pages.reduce((total, item) => total + item.internalLinks.length, 0);
    expect(retained).toBeGreaterThan(0);
    expect(retained).toBeLessThan(100 * 200);
    expect(restored.pages.some((item) => item.internalLinksTruncated)).toBe(true);
    const result = compareSessions(restored, crawl);
    expect(result.counts.removedLinks).toBe(0);
    expect(result.counts.addedLinks).toBe(0);
    expect(result.counts.linkPagesNotComparable).toBeGreaterThan(0);
    console.info(
      `overflow snapshot retainedLinks=${retained} of=${100 * 200} notComparablePages=${result.counts.linkPagesNotComparable}`,
    );
    localStorage.clear();
  });

  it("shows the same-crawl summary and keeps incomplete link pages behind a disclosure", () => {
    const crawl = session([
      page(`${origin}/about`, { findings: finding("RULE_META_DESCRIPTION_MISSING") }),
      page(`${origin}/`, {
        internalLinks: [`${origin}/about`],
        internalLinksTruncated: true,
      }),
    ]);
    const same = compareSessions(crawl, structuredClone(crawl));
    const wrapper = mount(SiteComparePanel, { props: { comparison: same } });
    expect(wrapper.text()).toContain(
      "You're comparing a crawl with itself. No confirmed SEO changes were detected.",
    );
    expect(wrapper.text()).toContain("Crawl coverage");
    expect(wrapper.text()).toContain("Issue changes");
    expect(wrapper.text()).toContain("Comparison reliability");
    expect(wrapper.text()).toContain("View 1 pages with incomplete link data");
    const details = wrapper.get("details");
    expect(details.text()).toContain(
      "Link changes on this page were not verified because its link list was truncated.",
    );
    expect(wrapper.text().replace(details.text(), "")).not.toContain(
      "Link changes on this page were not verified because its link list was truncated.",
    );
    expect(wrapper.text()).toContain("No confirmed link changes.");
    wrapper.unmount();
  });

  it.skipIf(process.env.RANKMISO_RUN_PERF !== "1")(
    "benchmarks comparison for small, medium, and 100-page crawls",
    () => {
      const sizes = [1, 10, 25, 50, 100];
      for (const count of sizes) {
        const pages = Array.from({ length: count }, (_, index) =>
          page(`${origin}/p/${index}`, {
            title: `Title ${index % 7}`,
            findings:
              index % 3 === 0 ? finding("RULE_META_DESCRIPTION_MISSING", String(index)) : [],
            internalLinks: Array.from(
              { length: 200 },
              (_unused, link) => `${origin}/p/${(index + link + 1) % count}`,
            ),
            internalLinkDetails: Array.from({ length: 200 }, (_unused, link) => ({
              url: `${origin}/p/${(index + link + 1) % count}`,
              rel: [],
              anchorText: `Link ${link}`,
              target: "",
            })),
          }),
        );
        const currentPages = pages.map((item, index) =>
          index === 0 ? { ...item, title: "Changed", findings: [] } : item,
        );
        const samples: number[] = [];
        for (let run = 0; run < 6; run += 1) {
          const started = performance.now();
          const result = compareSessions(session(pages), session(currentPages));
          if (run > 0) samples.push(performance.now() - started);
          expect(result.coverage.sharedPages).toBe(count);
        }
        samples.sort((left, right) => left - right);
        const serializeStarted = performance.now();
        const bounded = boundSession(session(pages), "comparison");
        const serializeMs = performance.now() - serializeStarted;
        const restoreStarted = performance.now();
        const restored = bounded ? (JSON.parse(JSON.stringify(bounded)) as CrawlSession) : null;
        const restoreMs = performance.now() - restoreStarted;
        const retained = restored
          ? restored.pages.reduce((total, item) => total + item.internalLinks.length, 0)
          : 0;
        const truncatedPages = restored
          ? restored.pages.filter((item) => item.internalLinksTruncated).length
          : count;
        console.info(
          `Crawl comparison pages=${count} links/page=200 median=${samples[2]?.toFixed(2)}ms max=${samples[4]?.toFixed(2)}ms n=5 node=${process.version} serialize=${serializeMs.toFixed(2)}ms restore=${restoreMs.toFixed(2)}ms snapshotBytes=${bounded ? JSON.stringify(bounded).length : "too-large"} rawBytes=${JSON.stringify(session(pages)).length} retainedLinks=${retained} truncatedPages=${truncatedPages}`,
        );
      }
    },
    30_000,
  );
});
