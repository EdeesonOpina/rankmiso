import { describe, expect, it } from "vitest";
import {
  byTime,
  categoryChange,
  compareAudits,
  compareRecords,
  historyCsv,
  historyHtml,
  historyJson,
  normalizeSavedReport,
  pageIdentity,
  recordsForPage,
  summarizeAudit,
  type HistoryDetail,
  type ReportComparison,
  type SavedFinding,
  type SavedReport,
} from "../src/services/saved-reports";
import type { AuditResult } from "../src/types/audit";

function audit(overrides: Partial<AuditResult["details"]> = {}): AuditResult {
  return {
    schemaVersion: 1,
    rulesetVersion: "1.0.0",
    page: { url: "https://example.com/", title: "New title", language: "en" },
    score: { value: 84, available: true } as AuditResult["score"],
    checks: [],
    recommendations: [],
    metrics: {} as AuditResult["metrics"],
    details: {
      metadata: {
        title: "New title",
        description: "New description",
        canonicals: [],
      } as unknown as AuditResult["details"]["metadata"],
      headings: [{ level: 1, text: "New heading", location: "h1" }],
      links: [],
      images: [],
      structuredData: [],
      ...overrides,
    } as AuditResult["details"],
    source: {} as AuditResult["source"],
    analyzedAt: "2026-10-24T00:00:00.000Z",
  };
}

describe("saved report comparison", () => {
  it("lists changed values and omits unchanged values", () => {
    const previous: ReportComparison = {
      url: "https://example.com/",
      title: "Old title",
      description: "New description",
      canonicals: [],
      headingCount: 1,
      h1Count: 1,
      linkCount: 0,
      imageCount: 0,
      missingAltCount: 0,
      schemaTypes: [],
      score: 84,
    };

    const differences = compareAudits(previous, audit());

    expect(differences.map(({ label }) => label)).toEqual(["reports.fieldTitle"]);
    expect(differences[0]).toMatchObject({ previous: "Old title", current: "New title" });
  });

  it("compares page signals across URLs without retaining full audit content", () => {
    const previous: ReportComparison = {
      url: "https://example.com/old",
      title: "Old",
      description: null,
      canonicals: [],
      headingCount: 0,
      h1Count: 0,
      linkCount: 2,
      imageCount: 1,
      missingAltCount: 1,
      schemaTypes: ["Article"],
      score: null,
    };

    const differences = compareAudits(previous, audit());

    expect(differences.map(({ label }) => label)).toContain("reports.fieldLinks");
    expect(differences.map(({ label }) => label)).toContain("reports.fieldSchemaTypes");
    expect(differences.map(({ label }) => label)).toContain("reports.fieldUrl");
  });
});

describe("history records", () => {
  it("keeps a legacy save and a later schema without inventing missing history", () => {
    const legacy = {
      id: "legacy-1",
      savedAt: "2020-01-02T03:04:05.000Z",
      comparison: {
        url: "https://example.com/page?x=1#part",
        title: "Legacy title",
        description: null,
        canonicals: { 0: "https://example.com/page?x=1" },
        headingCount: 1,
        h1Count: 1,
        linkCount: 0,
        imageCount: 0,
        missingAltCount: 0,
        schemaTypes: [],
        score: 50,
      },
    };
    const future = {
      ...legacy,
      id: "future-1",
      schemaVersion: 9,
      comparison: { ...legacy.comparison, url: "https://example.com/page?x=1", score: 60 },
    };
    const parsed = [legacy, { id: 1 }, future].flatMap(normalizeSavedReport);

    expect(parsed.map((report) => report.id)).toEqual(["legacy-1", "future-1"]);
    expect(parsed[0]?.comparison.history).toBeUndefined();
    expect(parsed[0]?.comparison.canonicals).toEqual(["https://example.com/page?x=1"]);
    expect(parsed[1]?.schemaVersion).toBe(9);
    expect(pageIdentity(parsed[0]?.comparison.url ?? "")).toBe("https://example.com/page?x=1");
    expect(pageIdentity("https://example.com/page?x=2")).not.toBe(
      pageIdentity("https://example.com/page?x=1"),
    );
  });

  it("keeps same-day saves distinct and does not treat a missing score as zero", () => {
    const first = record("a", "2026-10-28T01:00:00.000Z", 70);
    const second = record("b", "2026-10-28T02:00:00.000Z", null);
    const ordered = byTime([second, first], "asc");

    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
    expect(compareRecords(first, second).score).toEqual({ kind: "missing" });
    expect(
      recordsForPage(
        [first, record("c", "2026-10-28T03:00:00.000Z", 10, "https://other.example/")],
        first.comparison.url,
      ),
    ).toHaveLength(1);
  });

  it("classifies findings only when the rule set and check results were saved", () => {
    const before = record("a", "2026-10-28T01:00:00.000Z", 70);
    const after = record("b", "2026-10-28T02:00:00.000Z", 80);
    before.comparison.history = detail([
      finding("RULE_META_TITLE_MISSING", "ERROR", "Title is missing"),
      finding("RULE_META_DESCRIPTION_LENGTH", "WARNING", "Description length"),
      finding("RULE_H1_MISSING", "PASS", "H1 is present"),
    ]);
    after.comparison.history = detail([
      finding("RULE_META_TITLE_MISSING", "PASS", "Title is missing"),
      finding("RULE_META_DESCRIPTION_LENGTH", "WARNING", "Description length"),
      finding("RULE_H1_MISSING", "ERROR", "H1 is missing"),
    ]);

    const compared = compareRecords(before, after);

    expect(compared.score).toMatchObject({ kind: "delta", before: 70, after: 80 });
    expect(compared.resolved.map((item) => item.id)).toEqual(["RULE_META_TITLE_MISSING"]);
    expect(compared.unchanged.map((item) => item.id)).toEqual(["RULE_META_DESCRIPTION_LENGTH"]);
    expect(compared.introduced.map((item) => item.id)).toEqual(["RULE_H1_MISSING"]);
    expect(compared.undetermined).toEqual([]);
    expect(compared.findings).toBe("ready");

    const changedCoverage = record("c", "2026-10-28T03:00:00.000Z", 85);
    changedCoverage.comparison.history = detail([
      finding("RULE_META_TITLE_MISSING", "ERROR", "Title is missing"),
      finding("RULE_META_CANONICAL_MISSING", "PASS", "Canonical is present"),
    ]);
    const limitedCoverage = compareRecords(before, changedCoverage);
    expect(limitedCoverage.score.kind).toBe("limited");
    expect(limitedCoverage.errors.kind).toBe("limited");
    expect(limitedCoverage.coverageChanged).toBe(true);

    const reordered = record("d", "2026-10-28T04:00:00.000Z", 80);
    reordered.comparison.history = detail([
      finding("RULE_H1_MISSING", "ERROR", "H1 is missing"),
      finding("RULE_META_DESCRIPTION_LENGTH", "WARNING", "Description length"),
      finding("RULE_META_TITLE_MISSING", "PASS", "Title is present"),
    ]);
    expect(compareRecords(before, reordered).score.kind).toBe("delta");

    const categoryCoverage = record("e", "2026-10-28T05:00:00.000Z", 88);
    categoryCoverage.comparison.history = detail([
      finding("RULE_META_TITLE_MISSING", "ERROR", "Title is missing"),
      finding("RULE_META_CANONICAL_MISSING", "PASS", "Canonical is present"),
    ]);
    expect(categoryChange(before, categoryCoverage, "metadata").kind).toBe("limited");

    after.comparison.history = {
      ...detail([finding("RULE_META_TITLE_MISSING", "UNAVAILABLE", "Title is missing")]),
      rulesetVersion: "9.0.0",
    };
    const limited = compareRecords(before, after);
    expect(limited.score.kind).toBe("limited");
    expect(limited.findings).toBe("rules");
    expect(limited.resolved).toEqual([]);

    const legacy = record("old", "2020-01-01T00:00:00.000Z", 40);
    delete legacy.comparison.history;
    expect(compareRecords(legacy, before).findings).toBe("missing");
    expect(compareRecords(legacy, before).score.kind).toBe("limited");
    expect(categoryChange(before, after, "performance").kind).toBe("unmeasured");
  });

  it("stores check identifiers without page text and escapes exports", () => {
    const source = audit();
    source.score = {
      ...source.score,
      errors: 1,
      warnings: 0,
      passed: 3,
      unavailable: 1,
      applicableChecks: 4,
      categories: [
        {
          category: "metadata",
          available: true,
          value: 80,
          applicableChecks: 2,
          errors: 1,
          warnings: 0,
          passed: 1,
        },
        {
          category: "performance",
          available: false,
          value: null,
          applicableChecks: 0,
          errors: 0,
          warnings: 0,
          passed: 0,
        },
      ],
    };
    source.checks = [
      {
        id: "RULE_META_TITLE_MISSING",
        category: "metadata",
        status: "ERROR",
        weight: 1,
        applicable: true,
        titleKey: "RULE_META_TITLE_MISSING",
        title: "Title is missing",
        description: "full page text should not be copied from evidence",
        evidence: [{ label: "text", value: "full page text" }],
        recommendation: null,
        references: [],
      },
    ];
    const summary = summarizeAudit(source);
    expect(JSON.stringify(summary)).not.toContain("full page text");
    expect(summary.history?.findings?.[0]?.id).toBe("RULE_META_TITLE_MISSING");
    expect(
      summary.history?.categories?.find((item) => item.category === "performance")?.value,
    ).toBeNull();

    const saved = record("a", "2026-10-28T01:00:00.000Z", 70);
    saved.comparison.title = "=cmd<script>";
    expect(historyCsv([saved])).toContain(`"'=cmd<script>"`);
    expect(historyHtml([saved], null)).toContain("&lt;script&gt;");
    expect(historyHtml([saved], null)).not.toContain("<script>");
    expect(historyJson([saved], null)).not.toContain("https://other.example/");
  });
});

function record(
  id: string,
  savedAt: string,
  score: number | null,
  url = "https://example.com/",
): SavedReport {
  return {
    id,
    savedAt,
    schemaVersion: 2,
    comparison: {
      url,
      title: "Title",
      description: null,
      canonicals: [],
      headingCount: 1,
      h1Count: 1,
      linkCount: 0,
      imageCount: 0,
      missingAltCount: 0,
      schemaTypes: [],
      score,
      history: detail([]),
    },
  };
}

function detail(findings: SavedFinding[]): HistoryDetail {
  return {
    schemaVersion: 2,
    rulesetVersion: "1.0.0",
    errors: findings.filter((item) => item.status === "ERROR").length,
    warnings: findings.filter((item) => item.status === "WARNING").length,
    passed: findings.filter((item) => item.status === "PASS").length,
    unavailable: findings.filter((item) => item.status === "UNAVAILABLE").length,
    applicableChecks: 4,
    categories: [
      { category: "metadata", available: true, value: 80, applicableChecks: 2 },
      { category: "performance", available: false, value: null, applicableChecks: 0 },
    ],
    findings,
  };
}

function finding(id: string, status: SavedFinding["status"], title: string): SavedFinding {
  return { id, status, category: "metadata", title };
}
