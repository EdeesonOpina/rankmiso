import { toCsv } from "@rankmiso/report-formats";
import { appConfig } from "../config/app.config";

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

export interface CrawlPage {
  url: string;
  finalUrl: string;
  status: number | null;
  contentType: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  h1Count: number;
  internalLinks: string[];
  externalLinks: number;
  indexability: Indexability;
  issues: string[];
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
  pages: CrawlPage[];
  duplicates: CrawlDuplicate[];
  orphans: string[];
  note: string;
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
  if (
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const numbers = parts.map((part) => Number(part));
  const first = numbers[0] ?? 0;
  const second = numbers[1] ?? 0;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
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
    description: "",
    canonical: "",
    robots: "",
    h1Count: 0,
    internalLinks: [],
    externalLinks: 0,
    indexability: "unknown",
    issues: [],
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
  readRobots: () => Promise<{ status: number | null; body: string; unavailable: boolean }>;
  discoverSitemaps: () => Promise<{
    urls: string[];
    unavailable: boolean;
    empty: boolean;
  }>;
  mayFetch: (path: string) => Promise<boolean>;
  fetchPage: (url: string, signal: AbortSignal) => Promise<FetchResult>;
  inspect: (page: CrawlPage, html: string) => Promise<CrawlPage>;
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
  const robots = await options.readRobots();
  if (options.signal.aborted) return finish(session, "stopped", true);
  if (robots.unavailable) {
    session.robots = "unavailable";
    session.sitemap = "not-read";
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
      return;
    }
    discovered.add(url);
    queue.push({ url, depth, fromSitemap });
  };
  push(start, 0, false);
  if (robots.status !== 404) {
    const maps = await options.discoverSitemaps();
    if (maps.unavailable) session.sitemap = "unavailable";
    else if (maps.empty || maps.urls.length === 0) session.sitemap = "empty";
    else session.sitemap = "urls";
    session.sitemapUrls = maps.urls.length;
    for (const url of maps.urls) push(url, 0, true);
  } else {
    const maps = await options.discoverSitemaps();
    session.sitemap = maps.unavailable ? "unavailable" : maps.urls.length ? "urls" : "empty";
    session.sitemapUrls = maps.urls.length;
    for (const url of maps.urls) push(url, 0, true);
  }

  let cursor = 0;
  let pending = 0;
  let fetched = 0;
  const started = Date.now();
  const seenFetch = new Set<string>();

  async function worker() {
    while (!options.signal.aborted && Date.now() - started < limits.maxDurationMs) {
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
        return;
      }
      seenFetch.add(item.url);
      pending += 1;
      try {
        const path = `${new URL(item.url).pathname}${new URL(item.url).search}`;
        const allowed = session.robots === "missing" ? true : await options.mayFetch(path);
        if (!allowed) {
          session.pages.push({
            ...blankPage(item.url, item.depth, item.fromSitemap),
            skipped: "robots.txt disallows this crawler",
          });
          options.onProgress?.(session);
          continue;
        }
        fetched += 1;
        let result = await options.fetchPage(item.url, options.signal);
        if (result.retryable && limits.retries > 0 && !options.signal.aborted) {
          await wait(500);
          result = await options.fetchPage(item.url, options.signal);
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
            const inspected = await options.inspect(page, result.html);
            Object.assign(page, inspected, {
              url: item.url,
              fromSitemap: item.fromSitemap,
              depth: item.depth,
              redirectHops: result.hops,
              status: result.status,
            });
          } catch {
            page.error = page.error || "The page could not be scored.";
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
  session.orphans = session.partial || options.signal.aborted ? [] : orphanCandidates(session);
  if (options.signal.aborted) return finish(session, "stopped", true);
  if (Date.now() - started >= limits.maxDurationMs || fetched >= limits.maxPages) {
    session.partial = true;
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

export function saveCrawl(session: CrawlSession) {
  const copy: CrawlSession = {
    ...session,
    pages: session.pages.map((page) => ({
      ...page,
      internalLinks: page.internalLinks.slice(0, 50),
    })),
  };
  const json = JSON.stringify(copy);
  if (json.length > 350_000) return;
  localStorage.setItem(appConfig.siteCrawlKey, json);
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
