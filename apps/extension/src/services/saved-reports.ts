import { browser } from "wxt/browser";
import { appConfig } from "../config/app.config";
import type { AuditResult } from "../types/audit";
import type { MessageKey } from "../locales/en";

const STORAGE_KEY = "rankmiso.savedReports";
export const MAX_SAVED_REPORTS = appConfig.maxStoredReports;

export interface SavedReport {
  id: string;
  savedAt: string;
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
}

export interface ReportDifference {
  label: MessageKey;
  previous: string;
  current: string;
}

export async function readSavedReports(): Promise<SavedReport[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const reports = stored[STORAGE_KEY];
  if (!Array.isArray(reports)) return [];
  return reports.filter(isSavedReport).slice(0, MAX_SAVED_REPORTS);
}

export async function saveAudit(audit: AuditResult): Promise<SavedReport> {
  const reports = await readSavedReports();
  const report: SavedReport = {
    id: globalThis.crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    comparison: toComparison(audit),
  };
  await browser.storage.local.set({
    [STORAGE_KEY]: [report, ...reports].slice(0, MAX_SAVED_REPORTS),
  });
  return report;
}

export async function deleteSavedReport(id: string): Promise<void> {
  const reports = await readSavedReports();
  await browser.storage.local.set({
    [STORAGE_KEY]: reports.filter((report) => report.id !== id),
  });
}

export async function clearSavedReports(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
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

function toComparison(audit: AuditResult): ReportComparison {
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
  };
}

function isSavedReport(value: unknown): value is SavedReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Partial<SavedReport>;
  const comparison = report.comparison as Partial<ReportComparison> | undefined;
  return (
    typeof report.id === "string" &&
    typeof report.savedAt === "string" &&
    report.comparison !== null &&
    typeof comparison === "object" &&
    typeof comparison.url === "string" &&
    (typeof comparison.title === "string" || comparison.title === null) &&
    (typeof comparison.description === "string" || comparison.description === null) &&
    Array.isArray(comparison.canonicals) &&
    typeof comparison.headingCount === "number" &&
    typeof comparison.h1Count === "number" &&
    typeof comparison.linkCount === "number" &&
    typeof comparison.imageCount === "number" &&
    typeof comparison.missingAltCount === "number" &&
    Array.isArray(comparison.schemaTypes) &&
    (typeof comparison.score === "number" || comparison.score === null)
  );
}
