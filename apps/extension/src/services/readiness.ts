import { analyze_readiness } from "../wasm/pkg/seo_wasm.js";
import type { CheckResult, PageSnapshot } from "../types/audit";
import type { RenderingResult } from "./ai-search-store";
import type { AccessCheck } from "./crawler-access";
import { ensureEngine } from "./engine";

export type ReadinessGroup =
  "discoverability" | "structure" | "clarity" | "attribution" | "structuredData" | "accessibility";

export const readinessGroups: readonly ReadinessGroup[] = [
  "discoverability",
  "structure",
  "clarity",
  "attribution",
  "structuredData",
  "accessibility",
];

export type ReadinessFinding = CheckResult & {
  group: ReadinessGroup;
  /** An existing page check shown here, not a new rule. */
  reused: boolean;
};

export interface ReadinessReport {
  schemaVersion: number;
  pageType: "article" | "product" | "other";
  findings: ReadinessFinding[];
}

/**
 * Runs the Rust readiness rules on the page snapshot RankMiso already collected. Crawler access
 * and HTML comparison results are included only when the user already ran them for this URL.
 * No network request is made here.
 */
export async function analyzeReadiness(
  snapshot: PageSnapshot,
  crawler?: AccessCheck,
  rendering?: RenderingResult,
): Promise<ReadinessReport> {
  await ensureEngine();
  const request = {
    schemaVersion: 1,
    snapshot,
    crawler: crawler
      ? {
          checkedAt: crawler.checkedAt,
          robotsState: crawler.robotsState,
          pageAccess: crawler.report.pageAccess,
          agents: crawler.report.agents.map(({ id, crawl }) => ({ id, crawl })),
        }
      : undefined,
    rendering: rendering
      ? {
          sourceOrigin: rendering.report.sourceOrigin,
          findings: rendering.report.findings.map(({ id, status }) => ({ id, status })),
        }
      : undefined,
  };
  return JSON.parse(analyze_readiness(JSON.stringify(request))) as ReadinessReport;
}

export interface GroupSummary {
  completed: number;
  opportunities: number;
  clear: number;
  notMeasured: number;
  notApplicable: number;
}

/** Counts only; there is no readiness score. */
export function summarize(findings: readonly ReadinessFinding[]): GroupSummary {
  const summary = { completed: 0, opportunities: 0, clear: 0, notMeasured: 0, notApplicable: 0 };
  for (const finding of findings) {
    if (finding.status === "UNAVAILABLE") summary.notMeasured += 1;
    else if (finding.status === "NOT_APPLICABLE") summary.notApplicable += 1;
    else {
      summary.completed += 1;
      if (finding.status === "PASS") summary.clear += 1;
      else if (finding.status !== "INFO" || finding.recommendation) summary.opportunities += 1;
    }
  }
  return summary;
}
