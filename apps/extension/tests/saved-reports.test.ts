import { describe, expect, it } from "vitest";
import { compareAudits, type ReportComparison } from "../src/services/saved-reports";
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
