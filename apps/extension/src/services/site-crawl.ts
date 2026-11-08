import { toCsv } from "@rankmiso/report-formats";
import { appConfig } from "../config/app.config";
import type { Category, CheckStatus, Evidence } from "../types/audit";

export const CRAWL_LIMITS = {
  maxPages: 100,
  maxDepth: 3,
  concurrency: 2,
  timeoutMs: 10_000,
  maxBytes: 1_000_000,
  maxRedirects: 5,
  maxDurationMs: 120_000,
  maxDiscovered: 400,
  retries: 1,
} as const;

export type CrawlStatus = "idle" | "running" | "stopped" | "complete" | "error";
export type Indexability = "indexable" | "noindex" | "unknown";
export type CrawlMetadataState = "missing" | "empty" | "present";
export type CrawlLimitReason = "pages" | "discovered" | "depth" | "time";

export interface CrawlInternalLink {
  url: string;
  rel: string[];
  anchorText: string;
  target: string;
}

export interface CrawlFindingReference {
  id: string;
  status: Exclude<CheckStatus, "PASS">;
  evidence: Evidence[];
}

export interface CrawlFindingDefinition {
  id: string;
  category: Category;
  title: string;
  description: string;
  recommendation: string | null;
}

export interface CrawlPage {
  url: string;
  finalUrl: string;
  status: number | null;
  contentType: string;
  title: string;
  titleState?: CrawlMetadataState;
  description: string;
  descriptionState?: CrawlMetadataState;
  canonical: string;
  canonicalCount?: number;
  robots: string;
  h1Count: number;
  analyzed?: boolean;
  internalLinks: string[];
  internalLinkDetails?: CrawlInternalLink[];
  internalLinksTruncated?: boolean;
  externalLinks: number;
  imageCount?: number;
  imagesMissingAlt?: number;
  structuredDataCount?: number;
  structuredDataTruncated?: boolean;
  indexability: Indexability;
  issues: string[];
  findings?: CrawlFindingReference[];
  error: string;
  skipped: string;
  redirectHops: string[];
  fromSitemap: boolean;
  depth: number;
}

export interface CrawlDuplicate {
  kind: "title" | "description";
  value: string;
  urls: string[];
}

export interface CrawlSession {
  id: string;
  startUrl: string;
  origin: string;
  scope: string;
  status: CrawlStatus;
  startedAt: string;
  finishedAt: string | null;
  partial: boolean;
  robots: "read" | "missing" | "unavailable" | "not-read";
  sitemap: "urls" | "empty" | "unavailable" | "not-read";
  sitemapUrls: number;
  discoveredCount?: number;
  pageLimit?: number;
  depthLimit?: number;
  limitsReached?: CrawlLimitReason[];
  findingCatalog?: CrawlFindingDefinition[];
  pages: CrawlPage[];
  duplicates: CrawlDuplicate[];
  orphans: string[];
  note: string;
}

export interface CrawlInspectionResult {
  page: CrawlPage;
  findings: Array<CrawlFindingDefinition & { status: CheckStatus; evidence: Evidence[] }>;
}

export interface FetchResult {
  status: number | null;
  finalUrl: string;
  contentType: string;
  html: string;
  hops: string[];
  error: string;
  truncated: boolean;
  retryable: boolean;
}

type Limits = { -readonly [K in keyof typeof CRAWL_LIMITS]: number };

export function crawlUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }
    return url.href;
  } catch {
    return null;
  }
}

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.includes(":")) {
    const words = ipv6Words(host);
    if (!words) return false;
    const allZeroPrefix = (length: number) => words.slice(0, length).every((word) => word === 0);
    if (allZeroPrefix(7) && (words[7] === 0 || words[7] === 1)) return true;
    if ((words[0]! & 0xfe00) === 0xfc00) return true; // Unique local fc00::/7.
    if ((words[0]! & 0xffc0) === 0xfe80) return true; // Link local fe80::/10.
    if ((words[0]! & 0xffc0) === 0xfec0) return true; // Deprecated site local fec0::/10.
    if ((words[0]! & 0xff00) === 0xff00) return true; // Multicast is not a crawl destination.
    const mapped = allZeroPrefix(5) && words[5] === 0xffff;
    const compatible = allZeroPrefix(6);
    if (mapped || compatible) {
      const v4 = `${words[6]! >>> 8}.${words[6]! & 0xff}.${words[7]! >>> 8}.${words[7]! & 0xff}`;
      return isPrivateIpv4(v4);
    }
    return false;
  }
  return isPrivateIpv4(host);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const first = numbers[0] ?? 0;
  const second = numbers[1] ?? 0;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
}

function ipv6Words(host: string): number[] | null {
  let value = host;
  if (value.includes(".")) {
    const separator = value.lastIndexOf(":");
    if (separator < 0) return null;
    const v4 = value.slice(separator + 1);
    const parts = v4.split(".").map(Number);
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    )
      return null;
    const high = ((parts[0] ?? 0) << 8) | (parts[1] ?? 0);
    const low = ((parts[2] ?? 0) << 8) | (parts[3] ?? 0);
    value = `${value.slice(0, separator)}:${high.toString(16)}:${low.toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0]!.split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const parse = (part: string) => (/^[\da-f]{1,4}$/i.test(part) ? Number.parseInt(part, 16) : null);
  const leftWords = left.map(parse);
  const rightWords = right.map(parse);
  if ([...leftWords, ...rightWords].some((word) => word === null)) return null;
  const zeroCount = halves.length === 2 ? 8 - leftWords.length - rightWords.length : 0;
  if ((halves.length === 2 && zeroCount < 1) || (halves.length === 1 && zeroCount !== 0))
    return null;
  const words = [...leftWords, ...Array<number>(zeroCount).fill(0), ...rightWords] as number[];
  return words.length === 8 ? words : null;
}

export function inCrawlScope(start: string, candidate: string): boolean {
  try {
    const from = new URL(start);
    const to = new URL(candidate);
    if (to.origin !== from.origin) return false;
    return isPrivateHostname(from.hostname) || !isPrivateHostname(to.hostname);
  } catch {
    return false;
  }
}

export function emptySession(startUrl: string): CrawlSession {
  const origin = crawlUrl(startUrl, startUrl);
  return {
    id: `${Date.now().toString(36)}`,
    startUrl,
    origin: origin ? new URL(origin).origin : "",
    scope: "This host only",
    status: "idle",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    partial: false,
    robots: "not-read",
    sitemap: "not-read",
    sitemapUrls: 0,
    discoveredCount: 0,
    pageLimit: CRAWL_LIMITS.maxPages,
    depthLimit: CRAWL_LIMITS.maxDepth,
    limitsReached: [],
    findingCatalog: [],
    pages: [],
    duplicates: [],
    orphans: [],
    note: "",
  };
}

function blankPage(url: string, depth: number, fromSitemap: boolean): CrawlPage {
  return {
    url,
    finalUrl: url,
    status: null,
    contentType: "",
    title: "",
    titleState: undefined,
    description: "",
    descriptionState: undefined,
    canonical: "",
    canonicalCount: 0,
    robots: "",
    h1Count: 0,
    analyzed: false,
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
    fromSitemap,
    depth,
  };
}

export async function runSiteCrawl(options: {
  startUrl: string;
  signal: AbortSignal;
  limits?: Partial<Limits>;
  readRobots: (
    signal: AbortSignal,
  ) => Promise<{ status: number | null; body: string; unavailable: boolean }>;
  discoverSitemaps: (signal: AbortSignal) => Promise<{
    urls: string[];
    unavailable: boolean;
    empty: boolean;
  }>;
  mayFetch: (path: string) => Promise<boolean>;
  fetchPage: (url: string, signal: AbortSignal) => Promise<FetchResult>;
  inspect: (page: CrawlPage, html: string) => Promise<CrawlPage | CrawlInspectionResult>;
  onProgress?: (session: CrawlSession) => void;
}): Promise<CrawlSession> {
  const limits = { ...CRAWL_LIMITS, ...options.limits };
  const start = crawlUrl(options.startUrl, options.startUrl);
  const session = emptySession(start ?? options.startUrl);
  session.status = "running";
  if (!start || !inCrawlScope(start, start)) {
    session.status = "error";
    session.note = "The starting address is not an HTTP page on one host.";
    session.finishedAt = new Date().toISOString();
    return session;
  }
  session.startUrl = start;
  session.origin = new URL(start).origin;
  session.pageLimit = limits.maxPages;
  session.depthLimit = limits.maxDepth;
  const markLimit = (reason: CrawlLimitReason) => {
    const reached = session.limitsReached ?? (session.limitsReached = []);
    if (!reached.includes(reason)) reached.push(reason);
  };
  const started = Date.now();
  const deadline = AbortSignal.timeout(limits.maxDurationMs);
  const signal = AbortSignal.any([options.signal, deadline]);
  const robots = await options.readRobots(signal);
  if (signal.aborted) {
    if (deadline.aborted) {
      markLimit("time");
      session.note = "The crawl reached its time limit; results are partial.";
    }
    return finish(session, deadline.aborted ? "complete" : "stopped", true);
  }
  if (robots.unavailable) {
    session.robots = "unavailable";
    session.sitemap = "not-read";
    session.discoveredCount = 1;
    session.note =
      "robots.txt could not be read, so no further addresses were fetched. A missing file is not the same as a failed request.";
    session.pages.push({
      ...blankPage(start, 0, false),
      skipped: "robots.txt was unavailable",
    });
    return finish(session, "complete", false);
  }
  session.robots = robots.status === 404 ? "missing" : "read";
  const discovered = new Set<string>();
  const queue: Array<{ url: string; depth: number; fromSitemap: boolean }> = [];
  const push = (value: string, depth: number, fromSitemap: boolean) => {
    const url = crawlUrl(value, start);
    if (!url || discovered.has(url) || !inCrawlScope(start, url)) return;
    if (discovered.size >= limits.maxDiscovered) {
      session.partial = true;
      markLimit("discovered");
      return;
    }
    discovered.add(url);
    session.discoveredCount = discovered.size;
    queue.push({ url, depth, fromSitemap });
  };
  push(start, 0, false);
  if (robots.status !== 404) {
    const maps = await options.discoverSitemaps(signal);
    if (signal.aborted) {
      if (deadline.aborted) {
        markLimit("time");
        session.note = "The crawl reached its time limit; results are partial.";
      }
      return finish(session, deadline.aborted ? "complete" : "stopped", true);
    }
    if (maps.unavailable) session.sitemap = "unavailable";
    else if (maps.empty || maps.urls.length === 0) session.sitemap = "empty";
    else session.sitemap = "urls";
    session.sitemapUrls = maps.urls.length;
    for (const url of maps.urls) push(url, 0, true);
  } else {
    const maps = await options.discoverSitemaps(signal);
    if (signal.aborted) {
      if (deadline.aborted) {
        markLimit("time");
        session.note = "The crawl reached its time limit; results are partial.";
      }
      return finish(session, deadline.aborted ? "complete" : "stopped", true);
    }
    session.sitemap = maps.unavailable ? "unavailable" : maps.urls.length ? "urls" : "empty";
    session.sitemapUrls = maps.urls.length;
    for (const url of maps.urls) push(url, 0, true);
  }

  let cursor = 0;
  let pending = 0;
  let fetched = 0;
  const seenFetch = new Set<string>();

  async function worker() {
    while (!signal.aborted && Date.now() - started < limits.maxDurationMs) {
      if (cursor >= queue.length) {
        if (pending === 0) return;
        await wait(20);
        continue;
      }
      const item = queue[cursor];
      cursor += 1;
      if (!item || seenFetch.has(item.url)) continue;
      if (fetched >= limits.maxPages) {
        session.partial = true;
        markLimit("pages");
        return;
      }
      seenFetch.add(item.url);
      pending += 1;
      try {
        const path = `${new URL(item.url).pathname}${new URL(item.url).search}`;
        const allowed = session.robots === "missing" ? true : await options.mayFetch(path);
        if (signal.aborted) break;
        if (!allowed) {
          session.pages.push({
            ...blankPage(item.url, item.depth, item.fromSitemap),
            skipped: "robots.txt disallows this crawler",
          });
          options.onProgress?.(session);
          continue;
        }
        fetched += 1;
        let result = await options.fetchPage(item.url, signal);
        if (result.retryable && limits.retries > 0 && !signal.aborted) {
          await wait(500);
          if (!signal.aborted) result = await options.fetchPage(item.url, signal);
        }
        const page = blankPage(item.url, item.depth, item.fromSitemap);
        page.status = result.status;
        page.finalUrl = result.finalUrl || item.url;
        page.contentType = result.contentType;
        page.redirectHops = result.hops;
        page.error = result.error;
        if (result.truncated) page.issues.push("The response was cut off before analysis.");
        if (!result.html && result.status && result.status < 400 && !result.error) {
          page.issues.push("This response is not HTML.");
        }
        if (result.html && !result.error) {
          try {
            const inspection = await options.inspect(page, result.html);
            const inspected = "page" in inspection ? inspection.page : inspection;
            const findingRefs: CrawlFindingReference[] = [];
            if ("page" in inspection) {
              for (const finding of inspection.findings) {
                if (finding.status === "PASS") continue;
                const catalog = session.findingCatalog ?? (session.findingCatalog = []);
                if (!catalog.some((item) => item.id === finding.id)) {
                  catalog.push({
                    id: finding.id,
                    category: finding.category,
                    title: finding.title,
                    description: finding.description,
                    recommendation: finding.recommendation,
                  });
                }
                findingRefs.push({
                  id: finding.id,
                  status: finding.status,
                  evidence: finding.evidence.slice(0, 2).map((item) => ({
                    label: item.label.slice(0, 80),
                    value: item.value.slice(0, 200),
                  })),
                });
              }
              page.issues = [
                ...page.issues,
                ...inspection.findings
                  .filter((finding) => finding.status === "ERROR" || finding.status === "WARNING")
                  .map((finding) => finding.title),
              ].slice(0, 12);
            }
            Object.assign(page, inspected, {
              url: item.url,
              fromSitemap: item.fromSitemap,
              depth: item.depth,
              redirectHops: result.hops,
              status: result.status,
            });
            if ("page" in inspection) page.findings = findingRefs;
          } catch {
            page.error = page.error || "The page could not be scored.";
          }
          if (item.depth >= limits.maxDepth && page.internalLinks.length > 0) {
            session.partial = true;
            markLimit("depth");
          }
          if (item.depth < limits.maxDepth) {
            for (const link of page.internalLinks) push(link, item.depth + 1, false);
          }
        }
        session.pages.push(page);
        options.onProgress?.(session);
      } finally {
        pending -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: limits.concurrency }, () => worker()));
  annotateLinks(session);
  session.duplicates = duplicateMetadata(session.pages);
  // Site-wide link coverage is bounded, so do not persist a site-wide orphan claim.
  session.orphans = [];
  if (signal.aborted) {
    if (deadline.aborted) {
      markLimit("time");
      session.note = "The crawl reached its time limit; results are partial.";
    }
    return finish(session, deadline.aborted ? "complete" : "stopped", true);
  }
  if (Date.now() - started >= limits.maxDurationMs || fetched >= limits.maxPages) {
    session.partial = true;
    if (Date.now() - started >= limits.maxDurationMs) {
      markLimit("time");
      session.note = "The crawl reached its time limit; results are partial.";
    }
    if (fetched >= limits.maxPages) markLimit("pages");
  }
  return finish(session, "complete", session.partial);
}

function annotateLinks(session: CrawlSession) {
  const byUrl = new Map(session.pages.map((page) => [page.finalUrl || page.url, page]));
  for (const page of session.pages) {
    let broken = 0;
    let redirected = 0;
    for (const link of page.internalLinks) {
      const target = byUrl.get(link);
      if (!target || target.skipped) continue;
      if ((target.status ?? 0) >= 400) broken += 1;
      else if (target.redirectHops.length > 0) redirected += 1;
    }
    if (broken) page.issues.push(`${broken.toString()} internal links returned an error.`);
    if (redirected) page.issues.push(`${redirected.toString()} internal links redirected.`);
  }
}

function finish(session: CrawlSession, status: CrawlStatus, partial: boolean): CrawlSession {
  session.status = status;
  session.partial = partial || session.partial;
  session.finishedAt = new Date().toISOString();
  if (!session.note && status === "stopped") {
    session.note = "The crawl was stopped. It will not resume on its own.";
  } else if (!session.note && session.partial) {
    session.note = "The crawl stopped at its limit. Counts are for the pages that were fetched.";
  }
  return session;
}

export function duplicateMetadata(pages: CrawlPage[]): CrawlDuplicate[] {
  const groups: CrawlDuplicate[] = [];
  collect("title", pages, groups);
  collect("description", pages, groups);
  return groups;
}

function collect(kind: "title" | "description", pages: CrawlPage[], groups: CrawlDuplicate[]) {
  const map = new Map<string, { value: string; urls: string[] }>();
  for (const page of pages) {
    if (page.skipped || page.error) continue;
    const original = kind === "title" ? page.title : page.description;
    const key = original.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    const group = map.get(key) ?? { value: original.trim(), urls: [] };
    group.urls.push(page.finalUrl || page.url);
    map.set(key, group);
  }
  for (const group of map.values()) {
    if (group.urls.length > 1) groups.push({ kind, value: group.value, urls: group.urls });
  }
}

export function orphanCandidates(session: CrawlSession): string[] {
  if (session.partial || session.status === "stopped") return [];
  const incoming = new Set<string>();
  for (const page of session.pages) {
    for (const link of page.internalLinks) {
      const url = crawlUrl(link, page.finalUrl || page.url);
      if (url) incoming.add(url);
    }
  }
  return session.pages
    .filter((page) => page.fromSitemap && !page.skipped && !incoming.has(page.url))
    .map((page) => page.url);
}

export function filterPages(pages: CrawlPage[], query: string, filter: string): CrawlPage[] {
  const needle = query.trim().toLowerCase();
  return pages.filter((page) => {
    if (filter === "issues" && page.issues.length === 0 && !page.error) return false;
    if (filter === "failed" && !page.error && (page.status == null || page.status < 400))
      return false;
    if (filter === "skipped" && !page.skipped) return false;
    if (!needle) return true;
    return `${page.url} ${page.title} ${page.description}`.toLowerCase().includes(needle);
  });
}

export function sortPages(pages: CrawlPage[], sort: string): CrawlPage[] {
  const copy = pages.slice();
  copy.sort((left, right) => {
    if (sort === "issues") return right.issues.length - left.issues.length;
    if (sort === "title") return left.title.localeCompare(right.title);
    return left.url.localeCompare(right.url);
  });
  return copy;
}

export function sessionCsv(session: CrawlSession): string {
  return toCsv(
    [
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
    ],
    session.pages.map((page) => [
      page.url,
      page.finalUrl,
      page.status ?? "",
      page.title,
      page.description,
      page.canonical,
      page.robots,
      page.indexability,
      page.issues.join("; "),
      page.skipped,
      page.error,
      page.internalLinks.length,
    ]),
  );
}

export function sessionJson(session: CrawlSession): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      origin: session.origin,
      scope: session.scope,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      status: session.status,
      partial: session.partial,
      robots: session.robots,
      sitemap: session.sitemap,
      sitemapUrls: session.sitemapUrls,
      note: session.note,
      pages: session.pages,
      duplicates: session.duplicates,
      orphans: session.orphans,
    },
    null,
    2,
  );
}

export function saveCrawl(session: CrawlSession): boolean {
  let copy: CrawlSession = {
    ...session,
    pages: session.pages.map((page) => ({
      ...page,
      internalLinks: page.internalLinks.slice(0, 50),
      internalLinkDetails: page.internalLinkDetails?.slice(0, 10).map((link) => ({
        ...link,
        anchorText: link.anchorText.slice(0, 80),
        rel: link.rel.slice(0, 8),
      })),
      internalLinksTruncated:
        page.internalLinksTruncated ||
        page.internalLinks.length > 50 ||
        (page.internalLinkDetails?.length ?? 0) > 10,
      title: page.title.slice(0, 500),
      description: page.description.slice(0, 2_000),
    })),
  };
  let json = JSON.stringify(copy);
  if (json.length > 350_000) {
    copy = {
      ...copy,
      pages: copy.pages.map((page) => ({
        ...page,
        internalLinks: page.internalLinks.slice(0, 25),
        internalLinksTruncated: page.internalLinksTruncated || page.internalLinks.length > 25,
        internalLinkDetails: [],
        findings: page.findings?.map((finding) => ({
          ...finding,
          evidence: finding.evidence
            .slice(0, 1)
            .map((item) => ({ label: item.label.slice(0, 60), value: item.value.slice(0, 100) })),
        })),
      })),
    };
    json = JSON.stringify(copy);
  }
  if (json.length > 350_000) {
    copy = {
      ...copy,
      pages: copy.pages.map((page) => ({
        ...page,
        findings: page.findings?.map((finding) => ({ ...finding, evidence: [] })),
      })),
    };
    json = JSON.stringify(copy);
  }
  if (json.length > 350_000) return false;
  try {
    localStorage.setItem(appConfig.siteCrawlKey, json);
    return true;
  } catch {
    return false;
  }
}

export function loadCrawl(origin: string): CrawlSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(appConfig.siteCrawlKey) || "") as CrawlSession;
    if (!parsed || parsed.origin !== origin || !Array.isArray(parsed.pages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCrawl() {
  localStorage.removeItem(appConfig.siteCrawlKey);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
