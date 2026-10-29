import { renderHtmlReport, safeFilename, toCsv } from "@rankmiso/report-formats";
import { browser } from "wxt/browser";
import type { AuditResult } from "../types/audit";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "page";
  }
}

export function exportAuditJson(audit: AuditResult) {
  download(
    safeFilename(`${hostOf(audit.page.url)}-audit`, "json"),
    JSON.stringify(audit, null, 2),
    "application/json",
  );
}

export function exportChecksCsv(audit: AuditResult) {
  download(
    safeFilename(`${hostOf(audit.page.url)}-checks`, "csv"),
    toCsv(
      ["id", "status", "category", "title", "description", "recommendation", "evidence"],
      audit.checks.map((check) => [
        check.id,
        check.status,
        check.category,
        check.title,
        check.description,
        check.recommendation ?? "",
        check.evidence.map((item) => `${item.label}: ${item.value}`).join(" | "),
      ]),
    ),
    "text/csv",
  );
}

export function exportLinksCsv(audit: AuditResult) {
  download(
    safeFilename(`${hostOf(audit.page.url)}-links`, "csv"),
    toCsv(
      ["classification", "accessibleName", "resolvedUrl", "href", "rel", "target"],
      audit.details.links.map((link) => [
        link.classification,
        link.accessibleName,
        link.resolvedUrl ?? "",
        link.href,
        link.rel.join(" "),
        link.target ?? "",
      ]),
    ),
    "text/csv",
  );
}

export function exportHeadingsCsv(audit: AuditResult) {
  download(
    safeFilename(`${hostOf(audit.page.url)}-headings`, "csv"),
    toCsv(
      ["level", "text", "location"],
      audit.details.headings.map((heading) => [heading.level, heading.text, heading.location]),
    ),
    "text/csv",
  );
}

export function exportImagesCsv(audit: AuditResult) {
  download(
    safeFilename(`${hostOf(audit.page.url)}-images`, "csv"),
    toCsv(
      ["src", "altPresent", "altValue", "broken", "loading", "renderedWidth", "renderedHeight"],
      audit.details.images.map((image) => [
        image.src ?? "",
        image.altPresent,
        image.altValue,
        image.broken == null ? "" : image.broken,
        image.loading ?? "",
        image.renderedWidth ?? "",
        image.renderedHeight ?? "",
      ]),
    ),
    "text/csv",
  );
}

export function exportHtmlReport(audit: AuditResult) {
  const html = renderHtmlReport({
    title: audit.page.title || audit.page.url,
    url: audit.page.url,
    analyzedAt: audit.analyzedAt,
    version: browser.runtime.getManifest().version,
    rulesetVersion: audit.rulesetVersion,
    score: audit.score.available ? String(audit.score.value) : "unavailable",
    disclaimer: audit.score.disclaimer,
    rows: audit.checks.map((check) => ({
      status: check.status,
      title: check.title,
      description: check.description,
      evidence: check.evidence.map((item) => `${item.label}: ${item.value}`).join(" | "),
    })),
  });
  download(safeFilename(`${hostOf(audit.page.url)}-report`, "html"), html, "text/html");
}
