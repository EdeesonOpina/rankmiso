import type { Category } from "../types/audit";
import { toCsv } from "@rankmiso/report-formats";
import type { CrawlLimitReason, CrawlPage, CrawlSession } from "./site-crawl";

export interface SiteIssue {
  id: string;
  category: Category | "unknown";
  title: string;
  description: string;
  recommendation: string | null;
  statuses: string[];
  affected: Array<{ url: string; evidence: string }>;
  searchText: string;
}

export interface DuplicateGroup {
  kind: "title" | "description";
  value: string;
  urls: string[];
}

export interface LinkObservation {
  source: string;
  target: string;
  targetState: "analyzed" | "failed" | "skipped" | "not-crawled";
  redirectTo: string | null;
  incomingSources: number;
  outgoingTargets: number;
  rel: string[];
  anchors: string[];
}

export interface SiteAnalysis {
  summary: {
    discovered: number;
    analyzed: number;
    failed: number;
    skipped: number;
    redirectAliases: number;
    unanalyzed: number;
    pagesWithErrors: number;
    pagesWithWarnings: number;
    pagesWithoutFindingData: number;
    partial: boolean;
    complete: boolean;
    pagesLimit: number;
    limitsReached: CrawlLimitReason[];
    missingTitles: number;
    emptyTitles: number;
    missingDescriptions: number;
    emptyDescriptions: number;
    canonicalObserved: number;
    canonicalIssues: number;
    h1Missing: number;
    multipleH1: number;
    robotsObserved: number;
    noindex: number;
    imagePages: number;
    images: number;
    imagesMissingAlt: number;
    structuredDataPages: number;
    structuredDataIssues: number;
    unavailableFindings: number;
  };
  duplicates: DuplicateGroup[];
  issues: SiteIssue[];
  links: LinkObservation[];
  lowIncomingPages: Array<{ url: string; incomingSources: number }>;
  linksTruncated: boolean;
}

const MAX_LINK_OBSERVATIONS = 5_000;

function sameOrigin(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

function successful(page: CrawlPage): boolean {
  return (
    !page.error &&
    !page.skipped &&
    page.status != null &&
    page.status < 400 &&
    page.analyzed !== false
  );
}

function normalizeMetadata(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");
}

export function duplicateGroups(pages: CrawlPage[]): DuplicateGroup[] {
  const result: DuplicateGroup[] = [];
  for (const kind of ["title", "description"] as const) {
    const groups = new Map<string, { value: string; urls: string[] }>();
    for (const page of pages) {
      if (!successful(page)) continue;
      const raw = kind === "title" ? page.title : page.description;
      if (!raw.trim()) continue;
      const key = normalizeMetadata(raw);
      if (!key) continue;
      const existing = groups.get(key) ?? { value: raw.trim().replace(/\s+/gu, " "), urls: [] };
      existing.urls.push(page.url);
      groups.set(key, existing);
    }
    for (const group of groups.values()) {
      if (group.urls.length > 1) result.push({ kind, ...group });
    }
  }
  return result.sort(
    (a, b) =>
      b.urls.length - a.urls.length ||
      a.kind.localeCompare(b.kind) ||
      a.value.localeCompare(b.value),
  );
}

export function analyzeSite(session: CrawlSession): SiteAnalysis {
  const pages = session.pages;
  // Several crawled URLs can redirect to one final page. Count that page once,
  // preferring the record fetched at the final URL itself.
  const byFinalUrl = new Map<string, CrawlPage>();
  for (const page of pages.filter(successful)) {
    const finalUrl = page.finalUrl || page.url;
    const kept = byFinalUrl.get(finalUrl);
    if (!kept || (kept.url !== finalUrl && page.url === finalUrl)) byFinalUrl.set(finalUrl, page);
  }
  const analyzedPages = [...byFinalUrl.values()];
  const counted = new Set(analyzedPages);
  const redirectAliases = new Set(pages.filter((page) => successful(page) && !counted.has(page)));
  const failed = pages.filter(
    (page) => !!page.error || (page.status != null && page.status >= 400),
  ).length;
  const skipped = pages.filter((page) => !!page.skipped).length;
  const observed = session.discoveredCount ?? pages.length;
  const unavailableFindings = pages.reduce(
    (total, page) =>
      total +
      (page.findings ?? []).filter(
        (finding) => finding.status === "UNAVAILABLE" || finding.status === "NOT_APPLICABLE",
      ).length,
    0,
  );
  const catalog = new Map((session.findingCatalog ?? []).map((item) => [item.id, item]));
  const issueMap = new Map<string, SiteIssue>();
  for (const page of pages) {
    if (redirectAliases.has(page)) continue;
    for (const finding of page.findings ?? []) {
      if (finding.status === "UNAVAILABLE" || finding.status === "NOT_APPLICABLE") continue;
      const definition = catalog.get(finding.id);
      if (!definition) continue;
      const issue = issueMap.get(finding.id) ?? {
        id: finding.id,
        category: definition.category,
        title: definition.title,
        description: definition.description,
        recommendation: definition.recommendation,
        statuses: [],
        affected: [],
        searchText: "",
      };
      if (!issue.statuses.includes(finding.status)) issue.statuses.push(finding.status);
      issue.affected.push({
        url: page.url,
        evidence: finding.evidence.map((item) => `${item.label}: ${item.value}`).join("; "),
      });
      issueMap.set(finding.id, issue);
    }
    // Backward-compatible records contain display issue titles without rule IDs.
    if (!page.findings?.length)
      for (const title of page.issues) {
        const id = `legacy:${title}`;
        const issue = issueMap.get(id) ?? {
          id,
          category: "unknown",
          title,
          description: "Finding from a saved crawl record.",
          recommendation: null,
          statuses: [],
          affected: [],
          searchText: "",
        };
        issue.affected.push({ url: page.url, evidence: "" });
        issueMap.set(id, issue);
      }
  }
  const issues = [...issueMap.values()]
    .map((issue) => {
      issue.affected.sort((a, b) => a.url.localeCompare(b.url));
      issue.searchText =
        `${issue.title} ${issue.description} ${issue.category} ${issue.affected.map((entry) => entry.url).join(" ")}`.toLocaleLowerCase(
          "und",
        );
      return issue;
    })
    .sort((a, b) => b.affected.length - a.affected.length || a.title.localeCompare(b.title));

  const pageByUrl = new Map<string, CrawlPage>();
  const aliases = new Map<string, string>();
  const sameOriginCache = new Map<string, boolean>();
  const isInternal = (value: string) => {
    const cached = sameOriginCache.get(value);
    if (cached !== undefined) return cached;
    const internal = sameOrigin(value, session.origin);
    sameOriginCache.set(value, internal);
    return internal;
  };
  for (const page of pages) {
    if (!isInternal(page.url)) continue;
    pageByUrl.set(page.url, page);
    aliases.set(page.url, page.url);
    if (page.finalUrl && !aliases.has(page.finalUrl)) aliases.set(page.finalUrl, page.url);
  }
  for (const [finalUrl, page] of byFinalUrl) aliases.set(finalUrl, page.url);
  const incoming = new Map<string, number>();
  const links: LinkObservation[] = [];
  let linksTruncated = false;
  for (const source of analyzedPages) {
    if (!isInternal(source.url)) continue;
    const details = source.internalLinkDetails;
    const detailByTarget = new Map<string, { rel: Set<string>; anchors: Set<string> }>();
    const validatedTargets = new Map<string, string>();
    for (const value of new Set(source.internalLinks)) {
      if (!isInternal(value)) continue;
      const target = aliases.get(value) ?? value;
      validatedTargets.set(value, target);
      if (!detailByTarget.has(target)) {
        detailByTarget.set(target, { rel: new Set<string>(), anchors: new Set<string>() });
      }
    }
    for (const link of details ?? []) {
      const target = validatedTargets.get(link.url);
      if (!target) continue;
      const detail = detailByTarget.get(target)!;
      link.rel.forEach((rel) => detail.rel.add(rel));
      if (link.anchorText) detail.anchors.add(link.anchorText);
    }
    for (const canonicalTarget of detailByTarget.keys()) {
      const targetPage = pageByUrl.get(canonicalTarget);
      const targetState: LinkObservation["targetState"] = targetPage
        ? targetPage.skipped
          ? "skipped"
          : targetPage.error || (targetPage.status != null && targetPage.status >= 400)
            ? "failed"
            : successful(targetPage)
              ? "analyzed"
              : "not-crawled"
        : "not-crawled";
      incoming.set(canonicalTarget, (incoming.get(canonicalTarget) ?? 0) + 1);
      if (links.length < MAX_LINK_OBSERVATIONS)
        links.push({
          source: source.url,
          target: canonicalTarget,
          targetState,
          redirectTo:
            targetPage && targetPage.finalUrl !== targetPage.url ? targetPage.finalUrl : null,
          incomingSources: 0,
          outgoingTargets: detailByTarget.size,
          rel: [...(detailByTarget.get(canonicalTarget)?.rel ?? [])].sort(),
          anchors: [...(detailByTarget.get(canonicalTarget)?.anchors ?? [])].slice(0, 3),
        });
      else linksTruncated = true;
    }
  }
  for (const link of links) link.incomingSources = incoming.get(link.target) ?? 0;

  return {
    summary: {
      discovered: observed,
      analyzed: analyzedPages.length,
      failed,
      skipped,
      redirectAliases: redirectAliases.size,
      unanalyzed: Math.max(
        0,
        observed - analyzedPages.length - redirectAliases.size - failed - skipped,
      ),
      // Worst finding per page, so the two counts never overlap.
      pagesWithErrors: analyzedPages.filter((page) =>
        page.findings?.some((finding) => finding.status === "ERROR"),
      ).length,
      pagesWithWarnings: analyzedPages.filter(
        (page) =>
          !page.findings?.some((finding) => finding.status === "ERROR") &&
          page.findings?.some((finding) => finding.status === "WARNING"),
      ).length,
      // Sessions saved before M9 have no per-page findings; never count them as clean.
      pagesWithoutFindingData: analyzedPages.filter((page) => page.findings === undefined).length,
      partial: session.partial || session.status === "stopped",
      complete: session.status === "complete" && !session.partial,
      pagesLimit: session.pageLimit ?? 100,
      limitsReached: session.limitsReached ?? [],
      missingTitles: analyzedPages.filter((page) => page.titleState === "missing").length,
      emptyTitles: analyzedPages.filter((page) => page.titleState === "empty").length,
      missingDescriptions: analyzedPages.filter((page) => page.descriptionState === "missing")
        .length,
      emptyDescriptions: analyzedPages.filter((page) => page.descriptionState === "empty").length,
      canonicalObserved: analyzedPages.filter(
        (page) => page.canonical || (page.canonicalCount ?? 0) > 0,
      ).length,
      canonicalIssues: analyzedPages.filter((page) =>
        page.findings?.some(
          (finding) =>
            finding.id.startsWith("RULE_CANONICAL_") &&
            (finding.status === "ERROR" || finding.status === "WARNING"),
        ),
      ).length,
      h1Missing: analyzedPages.filter(
        (page) =>
          page.findings?.some((finding) => finding.id === "RULE_H1_MISSING") ?? page.h1Count === 0,
      ).length,
      multipleH1: analyzedPages.filter(
        (page) =>
          page.findings?.some((finding) => finding.id === "RULE_MULTIPLE_H1") ?? page.h1Count > 1,
      ).length,
      robotsObserved: analyzedPages.filter((page) => !!page.robots).length,
      noindex: analyzedPages.filter((page) => page.indexability === "noindex").length,
      imagePages: analyzedPages.filter((page) => (page.imageCount ?? 0) > 0).length,
      images: analyzedPages.reduce((sum, page) => sum + (page.imageCount ?? 0), 0),
      imagesMissingAlt: analyzedPages.reduce((sum, page) => sum + (page.imagesMissingAlt ?? 0), 0),
      structuredDataPages: analyzedPages.filter((page) => (page.structuredDataCount ?? 0) > 0)
        .length,
      structuredDataIssues: analyzedPages.filter((page) =>
        page.findings?.some(
          (finding) =>
            finding.id === "RULE_JSONLD_SYNTAX" &&
            (finding.status === "ERROR" || finding.status === "WARNING"),
        ),
      ).length,
      unavailableFindings,
    },
    duplicates: duplicateGroups(analyzedPages),
    issues,
    links,
    lowIncomingPages: analyzedPages
      .filter((page) => isInternal(page.url))
      .map((page) => ({ url: page.url, incomingSources: incoming.get(page.url) ?? 0 }))
      .filter((item) => item.incomingSources <= 1)
      .sort((a, b) => a.incomingSources - b.incomingSources || a.url.localeCompare(b.url)),
    linksTruncated:
      linksTruncated ||
      pages.some(
        (page) =>
          page.internalLinksTruncated ||
          (page.analyzed === undefined && page.internalLinkDetails === undefined),
      ),
  };
}

export function filterSiteIssues(
  issues: SiteIssue[],
  query: string,
  category: string,
  severity: "all" | "error" | "warning" | "info" | "undefined" = "all",
): SiteIssue[] {
  const needle = query.trim().toLocaleLowerCase("und");
  return issues.filter((issue) => {
    if (category !== "all" && issue.category !== category) return false;
    if (needle && !issue.searchText.includes(needle)) return false;
    if (severity === "all") return true;
    if (severity === "undefined") return issue.statuses.length === 0;
    return issue.statuses.includes(severity.toUpperCase());
  });
}

export function sortSiteIssues(
  issues: SiteIssue[],
  sort: "affected" | "name" | "severity",
): SiteIssue[] {
  const severity = (issue: SiteIssue) =>
    issue.statuses.includes("ERROR")
      ? 0
      : issue.statuses.includes("WARNING")
        ? 1
        : issue.statuses.includes("INFO")
          ? 2
          : 3;
  return [...issues].sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title)
      : sort === "severity"
        ? severity(a) - severity(b) || b.affected.length - a.affected.length
        : b.affected.length - a.affected.length || severity(a) - severity(b),
  );
}

export function siteAnalysisCsv(session: CrawlSession): string {
  const analysis = analyzeSite(session);
  const headers = [
    "recordType",
    "url",
    "finalUrl",
    "status",
    "title",
    "description",
    "canonical",
    "robots",
    "indexability",
    "issues",
    "skipped",
    "error",
    "internalLinks",
    "relatedUrl",
    "redirectTo",
    "category",
    "issueId",
    "evidence",
    "metadataValue",
    "anchorText",
    "count",
    "partial",
  ];
  const rows: Array<Array<string | number | boolean>> = [];
  rows.push([
    "summary",
    session.origin,
    "",
    session.status,
    "Site Explorer summary",
    session.note,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "crawl",
    "",
    JSON.stringify({ ...analysis.summary, linksTruncated: analysis.linksTruncated }),
    "",
    "",
    analysis.summary.analyzed,
    analysis.summary.partial,
  ]);
  for (const page of session.pages) {
    rows.push([
      "page",
      page.url,
      page.finalUrl,
      page.error ? "failed" : page.skipped ? "skipped" : String(page.status ?? ""),
      page.title,
      page.description,
      page.canonical,
      page.robots,
      page.indexability,
      page.issues.join("; "),
      page.skipped,
      page.error,
      page.internalLinks.length,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      analysis.summary.partial,
    ]);
  }
  for (const issue of analysis.issues) {
    for (const affected of issue.affected) {
      rows.push([
        "issue",
        affected.url,
        "",
        issue.statuses.join("/"),
        issue.title,
        issue.description,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        issue.category,
        issue.id,
        affected.evidence,
        "",
        "",
        issue.affected.length,
        analysis.summary.partial,
      ]);
    }
  }
  for (const duplicate of analysis.duplicates) {
    for (const url of duplicate.urls) {
      rows.push([
        "duplicate",
        url,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "metadata",
        `duplicate-${duplicate.kind}`,
        "",
        duplicate.value,
        "",
        duplicate.urls.length,
        analysis.summary.partial,
      ]);
    }
  }
  for (const link of analysis.links) {
    rows.push([
      "link",
      link.source,
      "",
      link.targetState,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      link.outgoingTargets,
      link.target,
      link.redirectTo ?? "",
      "links",
      "",
      link.rel.join(" "),
      "",
      link.anchors.join(" | "),
      link.incomingSources,
      analysis.summary.partial,
    ]);
  }
  return toCsv(headers, rows);
}

export function siteAnalysisJson(session: CrawlSession): string {
  return JSON.stringify(
    { ...session, schemaVersion: 1, siteAnalysis: analyzeSite(session) },
    null,
    2,
  );
}
