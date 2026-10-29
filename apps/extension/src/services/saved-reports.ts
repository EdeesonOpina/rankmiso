import { browser } from "wxt/browser";
import { escapeHtml, safeFilename, toCsv } from "@rankmiso/report-formats";
import { appConfig } from "../config/app.config";
import type { AuditResult, Category, CheckStatus } from "../types/audit";
import type { MessageKey } from "../locales/en";

const STORAGE_KEY = "rankmiso.savedReports";
export const MAX_SAVED_REPORTS = appConfig.maxStoredReports;
export const HISTORY_SCHEMA = 2;

export interface SavedReport {
  id: string;
  savedAt: string;
  schemaVersion?: number;
  comparison: ReportComparison;
}

export interface ReportComparison {
  url: string;
  title: string | null;
  description: string | null;
  canonicals: string[];
  headingCount: number;
  h1Count: number;
  linkCount: number;
  imageCount: number;
  missingAltCount: number;
  schemaTypes: string[];
  score: number | null;
  history?: HistoryDetail;
}

/** Check ids and counts from one explicit save. Legacy records omit this. */
export interface HistoryDetail {
  schemaVersion: 2;
  rulesetVersion: string;
  errors: number;
  warnings: number;
  passed: number;
  unavailable: number;
  applicableChecks: number;
  categories: SavedCategory[] | null;
  findings: SavedFinding[] | null;
}

export interface SavedCategory {
  category: Category;
  available: boolean;
  value: number | null;
  applicableChecks: number;
}

export interface SavedFinding {
  id: string;
  status: CheckStatus;
  category: Category;
  title: string;
}

export interface ReportDifference {
  label: MessageKey;
  previous: string;
  current: string;
}

export type MeasureChange =
  | { kind: "delta"; before: number; after: number }
  | { kind: "limited"; before: number; after: number }
  | { kind: "missing" }
  | { kind: "unmeasured" };

export interface FindingDelta {
  id: string;
  title: string;
  before: CheckStatus | "";
  after: CheckStatus | "";
}

export interface HistoryComparison {
  score: MeasureChange;
  errors: MeasureChange;
  warnings: MeasureChange;
  coverageChanged: boolean;
  findings: "ready" | "missing" | "rules";
  resolved: FindingDelta[];
  introduced: FindingDelta[];
  unchanged: FindingDelta[];
  undetermined: FindingDelta[];
}

export function pageIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

export function byTime(reports: SavedReport[], direction: "asc" | "desc"): SavedReport[] {
  return reports
    .map((report, index) => ({ report, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.report.savedAt);
      const rightTime = Date.parse(right.report.savedAt);
      const leftOk = Number.isFinite(leftTime);
      const rightOk = Number.isFinite(rightTime);
      if (leftOk !== rightOk) return leftOk ? -1 : 1;
      if (leftOk && leftTime !== rightTime) {
        return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
      }
      return left.index - right.index;
    })
    .map((item) => item.report);
}

export function recordsForPage(reports: SavedReport[], pageUrl: string): SavedReport[] {
  const identity = pageIdentity(pageUrl);
  return reports.filter((report) => pageIdentity(report.comparison.url) === identity);
}

export async function readSavedReports(): Promise<SavedReport[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const reports = stored[STORAGE_KEY];
  if (!Array.isArray(reports)) return [];
  return reports.flatMap(normalizeSavedReport).slice(0, MAX_SAVED_REPORTS);
}

export async function saveAudit(audit: AuditResult): Promise<SavedReport> {
  const reports = await readSavedReports();
  const report: SavedReport = {
    id: globalThis.crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    schemaVersion: HISTORY_SCHEMA,
    comparison: summarizeAudit(audit),
  };
  // chrome.storage structured-clones Vue proxies; an empty reactive array becomes {}.
  const storedReports = JSON.parse(
    JSON.stringify([report, ...reports].slice(0, MAX_SAVED_REPORTS)),
  ) as SavedReport[];
  await browser.storage.local.set({ [STORAGE_KEY]: storedReports });
  return report;
}

export async function deleteSavedReport(id: string): Promise<void> {
  const reports = await readSavedReports();
  await browser.storage.local.set({
    [STORAGE_KEY]: JSON.parse(JSON.stringify(reports.filter((report) => report.id !== id))),
  });
}

export async function clearSavedReports(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function summarizeAudit(audit: AuditResult): ReportComparison {
  const errors = finiteCount(audit.score.errors);
  const warnings = finiteCount(audit.score.warnings);
  const passed = finiteCount(audit.score.passed);
  const unavailable = finiteCount(audit.score.unavailable);
  const applicableChecks = finiteCount(audit.score.applicableChecks);
  const history =
    errors == null ||
    warnings == null ||
    passed == null ||
    unavailable == null ||
    applicableChecks == null ||
    typeof audit.rulesetVersion !== "string"
      ? undefined
      : {
          schemaVersion: 2 as const,
          rulesetVersion: audit.rulesetVersion,
          errors,
          warnings,
          passed,
          unavailable,
          applicableChecks,
          categories: Array.isArray(audit.score.categories)
            ? audit.score.categories.map((category) => ({
                category: category.category,
                available: category.available,
                value: typeof category.value === "number" ? category.value : null,
                applicableChecks: finiteCount(category.applicableChecks) ?? 0,
              }))
            : null,
          findings: Array.isArray(audit.checks)
            ? audit.checks.map((check) => ({
                id: check.id,
                status: check.status,
                category: check.category,
                title: check.title.slice(0, 160),
              }))
            : null,
        };
  return {
    url: audit.page.url,
    title: audit.details.metadata.title,
    description: audit.details.metadata.description,
    canonicals: audit.details.metadata.canonicals,
    headingCount: audit.details.headings.length,
    h1Count: audit.details.headings.filter((item) => item.level === 1).length,
    linkCount: audit.details.links.length,
    imageCount: audit.details.images.length,
    missingAltCount: audit.details.images.filter((item) => !item.altPresent).length,
    schemaTypes: [...new Set(audit.details.structuredData.flatMap((block) => block.types))],
    score: audit.score.value,
    ...(history ? { history } : {}),
  };
}

export function compareAudits(
  previous: ReportComparison,
  current: AuditResult,
): ReportDifference[] {
  const value = (item: string | number | null | undefined) =>
    item == null || item === "" ? "—" : String(item);
  const canonicals = (items: string[]) => items.join(", ") || "—";
  const fields: ReportDifference[] = [
    { label: "reports.fieldUrl", previous: value(previous.url), current: value(current.page.url) },
    {
      label: "reports.fieldTitle",
      previous: value(previous.title),
      current: value(current.details.metadata.title),
    },
    {
      label: "reports.fieldDescription",
      previous: value(previous.description),
      current: value(current.details.metadata.description),
    },
    {
      label: "reports.fieldCanonicals",
      previous: canonicals(previous.canonicals),
      current: canonicals(current.details.metadata.canonicals),
    },
    {
      label: "reports.fieldHeadings",
      previous: value(previous.headingCount),
      current: value(current.details.headings.length),
    },
    {
      label: "reports.fieldH1",
      previous: value(previous.h1Count),
      current: value(current.details.headings.filter((item) => item.level === 1).length),
    },
    {
      label: "reports.fieldLinks",
      previous: value(previous.linkCount),
      current: value(current.details.links.length),
    },
    {
      label: "reports.fieldImages",
      previous: value(previous.imageCount),
      current: value(current.details.images.length),
    },
    {
      label: "reports.fieldMissingAlt",
      previous: value(previous.missingAltCount),
      current: value(current.details.images.filter((item) => !item.altPresent).length),
    },
    {
      label: "reports.fieldSchemaTypes",
      previous: previous.schemaTypes.join(", ") || "—",
      current:
        [...new Set(current.details.structuredData.flatMap((block) => block.types))].join(", ") ||
        "—",
    },
    {
      label: "reports.fieldScore",
      previous: value(previous.score),
      current: value(current.score.value),
    },
  ];
  return fields.filter((field) => field.previous !== field.current);
}

export function compareRecords(baseline: SavedReport, later: SavedReport): HistoryComparison {
  const before = baseline.comparison;
  const after = later.comparison;
  const sameRules =
    before.history != null &&
    after.history != null &&
    before.history.rulesetVersion === after.history.rulesetVersion;
  const coverageChanged = Boolean(
    sameRules && before.history?.applicableChecks !== after.history?.applicableChecks,
  );
  return {
    score: numberChange(before.score, after.score, sameRules && !coverageChanged),
    errors: numberChange(before.history?.errors, after.history?.errors, sameRules),
    warnings: numberChange(before.history?.warnings, after.history?.warnings, sameRules),
    coverageChanged,
    ...findingChanges(before, after, sameRules),
  };
}

export function categoryState(
  report: SavedReport,
  category: string,
): { kind: "score"; value: number } | { kind: "unmeasured" } | { kind: "missing" } {
  const row = report.comparison.history?.categories?.find((item) => item.category === category);
  if (!report.comparison.history || report.comparison.history.categories == null || !row) {
    return { kind: "missing" };
  }
  if (!row.available || row.value == null) return { kind: "unmeasured" };
  return { kind: "score", value: row.value };
}

export function categoryChange(
  baseline: SavedReport,
  later: SavedReport,
  category: string,
): MeasureChange {
  const before = categoryState(baseline, category);
  const after = categoryState(later, category);
  if (before.kind === "unmeasured" || after.kind === "unmeasured") return { kind: "unmeasured" };
  if (before.kind !== "score" || after.kind !== "score") return { kind: "missing" };
  const beforeRow = baseline.comparison.history?.categories?.find(
    (item) => item.category === category,
  );
  const afterRow = later.comparison.history?.categories?.find((item) => item.category === category);
  const sameRules =
    baseline.comparison.history?.rulesetVersion != null &&
    baseline.comparison.history.rulesetVersion === later.comparison.history?.rulesetVersion &&
    beforeRow?.applicableChecks === afterRow?.applicableChecks;
  return numberChange(before.value, after.value, Boolean(sameRules));
}

export function scoreConnects(previous: SavedReport, next: SavedReport): boolean {
  return compareRecords(previous, next).score.kind === "delta";
}

export function historyCsv(records: SavedReport[]): string {
  return toCsv(
    [
      "savedAt",
      "url",
      "title",
      "score",
      "errors",
      "warnings",
      "passed",
      "unavailable",
      "measuredChecks",
      "ruleset",
    ],
    records.map((report) => [
      report.savedAt,
      report.comparison.url,
      report.comparison.title,
      report.comparison.score,
      report.comparison.history?.errors ?? "",
      report.comparison.history?.warnings ?? "",
      report.comparison.history?.passed ?? "",
      report.comparison.history?.unavailable ?? "",
      report.comparison.history?.applicableChecks ?? "",
      report.comparison.history?.rulesetVersion ?? "",
    ]),
  );
}

export function historyJson(records: SavedReport[], comparison: HistoryComparison | null): string {
  return JSON.stringify(
    {
      schemaVersion: HISTORY_SCHEMA,
      note: "Saved measurements only. A score change is not a ranking change. Fields omitted from older saves were not recorded.",
      records,
      comparison,
    },
    null,
    2,
  );
}

export function historyHtml(records: SavedReport[], comparison: HistoryComparison | null): string {
  const rows = records
    .map(
      (report) => `<tr>
        <td>${escapeHtml(report.savedAt)}</td>
        <td>${escapeHtml(report.comparison.url)}</td>
        <td>${escapeHtml(report.comparison.title)}</td>
        <td>${escapeHtml(report.comparison.score ?? "Not recorded")}</td>
        <td>${escapeHtml(report.comparison.history?.errors ?? "Not recorded")}</td>
        <td>${escapeHtml(report.comparison.history?.warnings ?? "Not recorded")}</td>
      </tr>`,
    )
    .join("");
  const findingList = (title: string, items: FindingDelta[]) =>
    `<h2>${escapeHtml(title)}</h2><ul>${
      items.length
        ? items.map((item) => `<li>${escapeHtml(item.title || item.id)}</li>`).join("")
        : "<li>None</li>"
    }</ul>`;
  const findings =
    comparison == null
      ? ""
      : comparison.findings === "ready"
        ? `${findingList("Resolved", comparison.resolved)}${findingList("New", comparison.introduced)}${findingList("Unchanged", comparison.unchanged)}${findingList("Cannot determine", comparison.undetermined)}`
        : "<p>Individual issues cannot be compared from these saves.</p>";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>RankMiso history</title></head>
<body>
  <h1>Saved page history</h1>
  <p>These are explicit local measurements. A score change is not a change in rankings, traffic, or index coverage.</p>
  <table>
    <thead><tr><th>Saved</th><th>URL</th><th>Title</th><th>Score</th><th>Errors</th><th>Warnings</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${findings}
</body>
</html>`;
}

export function historyFilename(pageUrl: string, extension: string): string {
  return safeFilename(`${pageIdentity(pageUrl)}-history`, extension);
}

export function normalizeSavedReport(value: unknown): SavedReport[] {
  if (typeof value !== "object" || value === null) return [];
  const report = value as Partial<SavedReport>;
  const comparison = report.comparison as Partial<ReportComparison> | undefined;
  const canonicals = stringList(comparison?.canonicals);
  const schemaTypes = stringList(comparison?.schemaTypes);
  if (
    typeof report.id !== "string" ||
    typeof report.savedAt !== "string" ||
    comparison == null ||
    typeof comparison.url !== "string" ||
    (typeof comparison.title !== "string" && comparison.title !== null) ||
    (typeof comparison.description !== "string" && comparison.description !== null) ||
    canonicals === null ||
    typeof comparison.headingCount !== "number" ||
    typeof comparison.h1Count !== "number" ||
    typeof comparison.linkCount !== "number" ||
    typeof comparison.imageCount !== "number" ||
    typeof comparison.missingAltCount !== "number" ||
    schemaTypes === null ||
    (typeof comparison.score !== "number" && comparison.score !== null)
  ) {
    return [];
  }
  const history = readHistory(comparison.history);
  return [
    {
      id: report.id,
      savedAt: report.savedAt,
      ...(typeof report.schemaVersion === "number" ? { schemaVersion: report.schemaVersion } : {}),
      comparison: {
        url: comparison.url,
        title: comparison.title,
        description: comparison.description,
        canonicals,
        headingCount: comparison.headingCount,
        h1Count: comparison.h1Count,
        linkCount: comparison.linkCount,
        imageCount: comparison.imageCount,
        missingAltCount: comparison.missingAltCount,
        schemaTypes,
        score: comparison.score,
        ...(history ? { history } : {}),
      },
    },
  ];
}

function finiteCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function numberChange(
  before: number | null | undefined,
  after: number | null | undefined,
  comparable: boolean,
): MeasureChange {
  if (typeof before !== "number" || typeof after !== "number") return { kind: "missing" };
  if (!comparable) return { kind: "limited", before, after };
  return { kind: "delta", before, after };
}

function findingChanges(
  before: ReportComparison,
  after: ReportComparison,
  sameRules: boolean,
): Pick<HistoryComparison, "findings" | "resolved" | "introduced" | "unchanged" | "undetermined"> {
  const empty = { resolved: [], introduced: [], unchanged: [], undetermined: [] };
  if (!before.history?.findings || !after.history?.findings) {
    return { findings: "missing", ...empty };
  }
  if (!sameRules) return { findings: "rules", ...empty };
  const previous = new Map(before.history.findings.map((item) => [item.id, item]));
  const next = new Map(after.history.findings.map((item) => [item.id, item]));
  const resolved: FindingDelta[] = [];
  const introduced: FindingDelta[] = [];
  const unchanged: FindingDelta[] = [];
  const undetermined: FindingDelta[] = [];
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const left = previous.get(id);
    const right = next.get(id);
    const delta: FindingDelta = {
      id,
      title: right?.title || left?.title || id,
      before: left?.status ?? "",
      after: right?.status ?? "",
    };
    const kind = classifyFinding(left?.status, right?.status);
    if (kind === "resolved") resolved.push(delta);
    else if (kind === "introduced") introduced.push(delta);
    else if (kind === "unchanged") unchanged.push(delta);
    else if (kind === "unknown") undetermined.push(delta);
  }
  return { findings: "ready", resolved, introduced, unchanged, undetermined };
}

function classifyFinding(
  before: CheckStatus | undefined,
  after: CheckStatus | undefined,
): "resolved" | "introduced" | "unchanged" | "unknown" | "skip" {
  if (!before || !after) {
    if ((before && isIssue(before)) || (after && isIssue(after))) return "unknown";
    return "skip";
  }
  if (isIssue(before) && isClear(after)) return "resolved";
  if (isClear(before) && isIssue(after)) return "introduced";
  if (isIssue(before) && isIssue(after)) return "unchanged";
  if (isIssue(before) || isIssue(after)) return "unknown";
  return "skip";
}

function isIssue(status: CheckStatus): boolean {
  return status === "ERROR" || status === "WARNING";
}

function isClear(status: CheckStatus): boolean {
  return status === "PASS" || status === "INFO";
}

function readHistory(value: unknown): HistoryDetail | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const history = value as Partial<HistoryDetail>;
  const errors = finiteCount(history.errors);
  const warnings = finiteCount(history.warnings);
  const passed = finiteCount(history.passed);
  const unavailable = finiteCount(history.unavailable);
  const applicableChecks = finiteCount(history.applicableChecks);
  if (
    typeof history.rulesetVersion !== "string" ||
    errors == null ||
    warnings == null ||
    passed == null ||
    unavailable == null ||
    applicableChecks == null
  ) {
    return undefined;
  }
  return {
    schemaVersion: 2,
    rulesetVersion: history.rulesetVersion,
    errors,
    warnings,
    passed,
    unavailable,
    applicableChecks,
    categories: readCategories(history.categories),
    findings: readFindings(history.findings),
  };
}

function readCategories(value: unknown): SavedCategory[] | null {
  if (!Array.isArray(value)) return null;
  const categories: SavedCategory[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const category = item as Partial<SavedCategory>;
    if (typeof category.category !== "string" || typeof category.available !== "boolean") {
      return null;
    }
    if (typeof category.value !== "number" && category.value !== null) return null;
    const applicableChecks = finiteCount(category.applicableChecks);
    if (applicableChecks == null) return null;
    categories.push({
      category: category.category as Category,
      available: category.available,
      value: category.value,
      applicableChecks,
    });
  }
  return categories;
}

function readFindings(value: unknown): SavedFinding[] | null {
  if (!Array.isArray(value)) return null;
  const findings: SavedFinding[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const finding = item as Partial<SavedFinding>;
    if (
      typeof finding.id !== "string" ||
      typeof finding.status !== "string" ||
      typeof finding.category !== "string" ||
      typeof finding.title !== "string"
    ) {
      return null;
    }
    findings.push({
      id: finding.id,
      status: finding.status as CheckStatus,
      category: finding.category as Category,
      title: finding.title,
    });
  }
  return findings;
}

function stringList(value: unknown): string[] | null {
  const items = Array.isArray(value)
    ? value
    : value !== null && typeof value === "object"
      ? Object.values(value)
      : null;
  if (!items || items.some((item) => typeof item !== "string")) return null;
  return items;
}
