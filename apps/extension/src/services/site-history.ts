import { appConfig } from "../config/app.config";
import type { Category } from "../types/audit";
import {
  boundSession,
  restoreStoredSession,
  storedLink,
  type CrawlFindingReference,
  type CrawlPage,
  type CrawlSession,
} from "./site-crawl";

const CATEGORIES = new Set<Category>([
  "metadata",
  "content",
  "headings",
  "links",
  "images",
  "technical",
  "structuredData",
  "social",
  "performance",
  "international",
  "accessibility",
]);

/** Five snapshots at the 350 KB session bound. */
export const HISTORY_BUDGET_BYTES = 1_750_000;
const MAX_PAGES = 400;
const MAX_FIELD = 100_000;

export interface CrawlSnapshot {
  schemaVersion: 1;
  id: string;
  origin: string;
  savedAt: string;
  rankmisoVersion: string;
  rulesetVersion: string;
  linksBounded: boolean;
  session: CrawlSession;
}

export interface HistoryRead {
  snapshots: CrawlSnapshot[];
  unreadable: number;
  corruptStore: boolean;
}

export type SaveSnapshotFailure =
  "invalid" | "origin-full" | "budget" | "quota" | "too-large" | "corrupt";

export type SaveSnapshotResult =
  { ok: true; snapshot: CrawlSnapshot } | { ok: false; reason: SaveSnapshotFailure };

interface HistoryFile {
  schemaVersion: 1;
  records: unknown[];
}

function emptyRead(corruptStore: boolean): HistoryRead {
  return { snapshots: [], unreadable: 0, corruptStore };
}

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
  } catch {
    return false;
  }
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > MAX_FIELD) return null;
  return value.slice(0, max);
}

function copyPage(value: unknown): CrawlPage | null {
  if (!value || typeof value !== "object") return null;
  const page = value as Record<string, unknown>;
  const url = shortText(page.url, 2_000);
  if (!url) return null;
  const findings = Array.isArray(page.findings)
    ? page.findings.slice(0, 80).flatMap((item) => {
        const finding = copyFinding(item);
        return finding ? [finding] : [];
      })
    : undefined;
  return {
    url,
    finalUrl: shortText(page.finalUrl, 2_000) || url,
    status: typeof page.status === "number" && Number.isFinite(page.status) ? page.status : null,
    contentType: shortText(page.contentType, 200) || "",
    title: shortText(page.title, 500) || "",
    titleState:
      page.titleState === "missing" || page.titleState === "empty" || page.titleState === "present"
        ? page.titleState
        : undefined,
    titleTruncated:
      page.titleTruncated === true || (typeof page.title === "string" && page.title.length > 500),
    description: shortText(page.description, 2_000) || "",
    descriptionState:
      page.descriptionState === "missing" ||
      page.descriptionState === "empty" ||
      page.descriptionState === "present"
        ? page.descriptionState
        : undefined,
    descriptionTruncated:
      page.descriptionTruncated === true ||
      (typeof page.description === "string" && page.description.length > 2_000),
    canonical: shortText(page.canonical, 2_000) || "",
    canonicalCount: typeof page.canonicalCount === "number" ? page.canonicalCount : undefined,
    robots: shortText(page.robots, 500) || "",
    h1Count: typeof page.h1Count === "number" ? page.h1Count : 0,
    analyzed: typeof page.analyzed === "boolean" ? page.analyzed : undefined,
    internalLinks: Array.isArray(page.internalLinks)
      ? page.internalLinks.flatMap((item) => {
          const link = shortText(item, 2_000);
          return link ? [link] : [];
        })
      : [],
    internalLinkDetails: Array.isArray(page.internalLinkDetails)
      ? page.internalLinkDetails.slice(0, 50).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const link = item as Record<string, unknown>;
          const target = shortText(link.url, 2_000);
          if (!target) return [];
          return [
            {
              url: target,
              rel: Array.isArray(link.rel)
                ? link.rel.flatMap((rel) => {
                    const text = shortText(rel, 40);
                    return text ? [text] : [];
                  })
                : [],
              anchorText: shortText(link.anchorText, 80) || "",
              target: shortText(link.target, 2_000) || "",
            },
          ];
        })
      : undefined,
    internalLinksTruncated:
      typeof page.internalLinksTruncated === "boolean" ? page.internalLinksTruncated : undefined,
    externalLinks: typeof page.externalLinks === "number" ? page.externalLinks : 0,
    imageCount: typeof page.imageCount === "number" ? page.imageCount : undefined,
    imagesMissingAlt: typeof page.imagesMissingAlt === "number" ? page.imagesMissingAlt : undefined,
    structuredDataCount:
      typeof page.structuredDataCount === "number" ? page.structuredDataCount : undefined,
    structuredDataTruncated:
      typeof page.structuredDataTruncated === "boolean" ? page.structuredDataTruncated : undefined,
    indexability:
      page.indexability === "indexable" ||
      page.indexability === "noindex" ||
      page.indexability === "unknown"
        ? page.indexability
        : "unknown",
    issues: Array.isArray(page.issues)
      ? page.issues.flatMap((item) => {
          const text = shortText(item, 300);
          return text ? [text] : [];
        })
      : [],
    findings,
    error: shortText(page.error, 500) || "",
    skipped: shortText(page.skipped, 500) || "",
    redirectHops: Array.isArray(page.redirectHops)
      ? page.redirectHops.flatMap((item) => {
          const hop = shortText(item, 2_000);
          return hop ? [hop] : [];
        })
      : [],
    fromSitemap: page.fromSitemap === true,
    depth: typeof page.depth === "number" ? page.depth : 0,
  };
}

function copyFinding(value: unknown): CrawlFindingReference | null {
  if (!value || typeof value !== "object") return null;
  const finding = value as Record<string, unknown>;
  const id = shortText(finding.id, 120);
  if (!id) return null;
  if (
    finding.status !== "WARNING" &&
    finding.status !== "ERROR" &&
    finding.status !== "INFO" &&
    finding.status !== "NOT_APPLICABLE" &&
    finding.status !== "UNAVAILABLE"
  ) {
    return null;
  }
  const rawEvidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  let shortened = finding.evidenceTruncated === true || rawEvidence.length > 8;
  const evidence = rawEvidence.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.label === "string" && entry.label.length > 120) shortened = true;
    if (typeof entry.value === "string" && entry.value.length > 500) shortened = true;
    const label = shortText(entry.label, 120);
    const evidenceValue = shortText(entry.value, 500);
    if (label == null || evidenceValue == null) return [];
    return [{ label, value: evidenceValue }];
  });
  return {
    id,
    status: finding.status,
    evidence,
    ...(shortened ? { evidenceTruncated: true } : {}),
  };
}

export function snapshotFromRecord(value: unknown): CrawlSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) return null;
  const id = shortText(record.id, 80);
  const origin = shortText(record.origin, 2_000);
  const savedAt = shortText(record.savedAt, 40);
  const rankmisoVersion = shortText(record.rankmisoVersion, 40);
  const rulesetVersion = shortText(record.rulesetVersion, 40);
  if (!id || !origin || !isHttpOrigin(origin) || !savedAt || !rankmisoVersion || !rulesetVersion) {
    return null;
  }
  if (!record.session || typeof record.session !== "object") return null;
  const session = record.session as Record<string, unknown>;
  if (!Array.isArray(session.pages) || session.pages.length > MAX_PAGES) return null;
  if (session.origin !== origin) return null;
  const pages: CrawlPage[] = [];
  for (const page of session.pages) {
    const copied = copyPage(page);
    if (!copied) return null;
    pages.push(copied);
  }
  const restored: CrawlSession = {
    id: shortText(session.id, 80) || id,
    startUrl: shortText(session.startUrl, 2_000) || origin,
    origin,
    scope: shortText(session.scope, 200) || "",
    status:
      session.status === "idle" ||
      session.status === "running" ||
      session.status === "stopped" ||
      session.status === "complete" ||
      session.status === "error"
        ? session.status
        : "complete",
    startedAt: shortText(session.startedAt, 40) || "",
    finishedAt: shortText(session.finishedAt, 40),
    partial: session.partial === true,
    robots:
      session.robots === "read" ||
      session.robots === "missing" ||
      session.robots === "unavailable" ||
      session.robots === "not-read"
        ? session.robots
        : "not-read",
    sitemap:
      session.sitemap === "urls" ||
      session.sitemap === "empty" ||
      session.sitemap === "unavailable" ||
      session.sitemap === "not-read"
        ? session.sitemap
        : "not-read",
    sitemapUrls: typeof session.sitemapUrls === "number" ? session.sitemapUrls : 0,
    discoveredCount:
      typeof session.discoveredCount === "number" ? session.discoveredCount : undefined,
    pageLimit: typeof session.pageLimit === "number" ? session.pageLimit : undefined,
    depthLimit: typeof session.depthLimit === "number" ? session.depthLimit : undefined,
    limitsReached: Array.isArray(session.limitsReached)
      ? session.limitsReached.flatMap((item) =>
          item === "pages" || item === "discovered" || item === "depth" || item === "time"
            ? [item]
            : [],
        )
      : [],
    findingCatalog: Array.isArray(session.findingCatalog)
      ? session.findingCatalog.slice(0, 200).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const definition = item as Record<string, unknown>;
          const definitionId = shortText(definition.id, 120);
          const title = shortText(definition.title, 300);
          if (!definitionId || !title || !CATEGORIES.has(definition.category as Category))
            return [];
          return [
            {
              id: definitionId,
              category: definition.category as Category,
              title,
              description: shortText(definition.description, 1_000) || "",
              recommendation: shortText(definition.recommendation, 1_000),
            },
          ];
        })
      : [],
    pages,
    duplicates: [],
    orphans: [],
    note: shortText(session.note, 500) || "",
  };
  return {
    schemaVersion: 1,
    id,
    origin,
    savedAt,
    rankmisoVersion,
    rulesetVersion,
    linksBounded: pages.some(
      (page) =>
        page.internalLinksTruncated ||
        (page.analyzed === undefined && page.internalLinkDetails === undefined),
    ),
    session: restoreStoredSession(restored),
  };
}

function readFile(): { file: HistoryFile | null; corruptStore: boolean } {
  const raw = localStorage.getItem(appConfig.siteCrawlHistoryKey);
  if (!raw) return { file: { schemaVersion: 1, records: [] }, corruptStore: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { file: null, corruptStore: true };
    }
    const file = parsed as Record<string, unknown>;
    if (file.schemaVersion !== 1 || !Array.isArray(file.records)) {
      return { file: null, corruptStore: true };
    }
    return { file: { schemaVersion: 1, records: file.records }, corruptStore: false };
  } catch {
    return { file: null, corruptStore: true };
  }
}

export function readHistory(): HistoryRead {
  const { file, corruptStore } = readFile();
  if (!file) return emptyRead(corruptStore);
  const snapshots: CrawlSnapshot[] = [];
  let unreadable = 0;
  for (const record of file.records) {
    const snapshot = snapshotFromRecord(record);
    if (snapshot) snapshots.push(snapshot);
    else unreadable += 1;
  }
  snapshots.sort(
    (left, right) => right.savedAt.localeCompare(left.savedAt) || left.id.localeCompare(right.id),
  );
  return { snapshots, unreadable, corruptStore: false };
}

export function snapshotsForOrigin(origin: string): CrawlSnapshot[] {
  return readHistory().snapshots.filter((snapshot) => snapshot.origin === origin);
}

function compactHistoryRecord(record: unknown): unknown {
  if (!record || typeof record !== "object") return record;
  const snapshot = record as {
    session?: { origin?: unknown; pages?: Array<Record<string, unknown>> };
  };
  const origin = snapshot.session?.origin;
  if (typeof origin !== "string" || !Array.isArray(snapshot.session?.pages)) return record;
  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      pages: snapshot.session.pages.map((page) => ({
        ...page,
        internalLinks: Array.isArray(page.internalLinks)
          ? page.internalLinks.map((href) =>
              typeof href === "string" ? storedLink(href, origin) : href,
            )
          : page.internalLinks,
        internalLinkDetails: undefined,
      })),
    },
  };
}

function writeFile(records: unknown[]): SaveSnapshotFailure | null {
  try {
    const json = JSON.stringify({
      schemaVersion: 1,
      records: records.map(compactHistoryRecord),
    });
    if (json.length > HISTORY_BUDGET_BYTES) return "budget";
    localStorage.setItem(appConfig.siteCrawlHistoryKey, json);
    return null;
  } catch {
    return "quota";
  }
}

export function saveSnapshot(
  session: CrawlSession,
  rankmisoVersion: string,
  rulesetVersion: string,
  now = new Date().toISOString(),
): SaveSnapshotResult {
  if (!isHttpOrigin(session.origin) || !rankmisoVersion || !rulesetVersion) {
    return { ok: false, reason: "invalid" };
  }
  const bounded = boundSession(session, "comparison");
  if (!bounded) return { ok: false, reason: "too-large" };
  const { file, corruptStore } = readFile();
  if (corruptStore || !file) return { ok: false, reason: "corrupt" };
  const existing = file.records.filter((record) => {
    const snapshot = snapshotFromRecord(record);
    return snapshot?.origin === session.origin;
  });
  if (existing.length >= appConfig.maxCrawlSnapshotsPerOrigin) {
    return { ok: false, reason: "origin-full" };
  }
  const snapshot: CrawlSnapshot = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    origin: session.origin,
    savedAt: now,
    rankmisoVersion,
    rulesetVersion,
    linksBounded: false,
    session: bounded,
  };
  const stored = snapshotFromRecord(snapshot);
  if (!stored) return { ok: false, reason: "invalid" };
  const failure = writeFile([...file.records, stored]);
  if (failure) return { ok: false, reason: failure };
  return { ok: true, snapshot: stored };
}

export function deleteSnapshot(id: string): boolean {
  const { file, corruptStore } = readFile();
  if (corruptStore || !file) return false;
  const records = file.records.filter((record) => {
    if (!record || typeof record !== "object") return true;
    return (record as { id?: unknown }).id !== id;
  });
  if (records.length === file.records.length) return false;
  return writeFile(records) == null;
}

/** Removes only the comparison-history key. The latest crawl session is left alone. */
export function clearComparisonHistory(): void {
  localStorage.removeItem(appConfig.siteCrawlHistoryKey);
}

export function clearUnreadableHistory(): boolean {
  const { file, corruptStore } = readFile();
  if (corruptStore || !file) {
    clearComparisonHistory();
    return true;
  }
  const records = file.records.filter((record) => snapshotFromRecord(record));
  if (records.length === file.records.length) return false;
  return writeFile(records.map((record) => snapshotFromRecord(record))) == null;
}
