import { toCsv } from "@rankmiso/report-formats";
import { extractSitemap, inflateGzip, looksGzip, type SitemapEntry } from "./sitemap-xml";

/** Match the browser-side budgets documented in docs/features/sitemaps.md. */
export const SITEMAP_LIMITS = {
  maxFiles: 8,
  maxUrls: 500,
  maxBytes: 512_000,
  maxRedirects: 5,
  timeoutMs: 8_000,
} as const;

export type SitemapSource = "robots" | "conventional" | "user" | "child" | "import";
export type SitemapFetch = "fetched" | "missing" | "failed" | "external" | "imported";

export interface SitemapFileRecord {
  url: string;
  source: SitemapSource;
  fetch: SitemapFetch;
  kind: "urlset" | "index" | "invalid" | "dtd" | "gzip" | "unknown" | "empty" | "";
  truncated: boolean;
  entries: SitemapEntry[];
  children: string[];
}

export interface SitemapDocument {
  schemaVersion: 1;
  siteOrigin: string;
  pageUrl: string | null;
  partial: boolean;
  files: SitemapFileRecord[];
}

export interface SitemapCollection extends SitemapDocument {
  cancelled: boolean;
}

type Limits = { -readonly [K in keyof typeof SITEMAP_LIMITS]: number };

export function sitemapDirectives(body: string, robotsUrl: string): string[] {
  const urls: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const value = /^sitemap\s*:\s*(.+)$/i.exec(line)?.[1]?.trim();
    if (!value) continue;
    const absolute = absoluteHttp(value, robotsUrl);
    if (!absolute || urls.includes(absolute)) continue;
    urls.push(absolute);
    if (urls.length >= SITEMAP_LIMITS.maxFiles) break;
  }
  return urls;
}

export async function collectSitemaps(options: {
  pageUrl: string;
  signal: AbortSignal;
  network: boolean;
  networkPurpose?: "site-crawl";
  userUrl?: string;
  imported?: Array<{ name: string; bytes: Uint8Array }>;
  fetcher?: typeof fetch;
  limits?: Partial<Limits>;
}): Promise<SitemapCollection> {
  const limits = { ...SITEMAP_LIMITS, ...options.limits };
  const page = new URL(options.pageUrl);
  const files: SitemapFileRecord[] = [];
  let partial = false;
  let cancelled = false;
  let urlsLeft = limits.maxUrls;

  for (const item of options.imported ?? []) {
    if (files.length >= limits.maxFiles) {
      partial = true;
      break;
    }
    const record = await recordFromBytes(
      item.name,
      "import",
      "imported",
      item.bytes,
      null,
      urlsLeft,
      limits.maxBytes,
    );
    urlsLeft -= record.entries.length;
    if (record.truncated) partial = true;
    files.push(record);
  }

  if (!options.network) {
    return {
      schemaVersion: 1,
      siteOrigin: page.origin,
      pageUrl: options.pageUrl,
      partial,
      cancelled,
      files,
    };
  }

  const queue: Array<{ url: string; source: SitemapSource }> = [];
  const seen = new Set<string>();
  const push = (url: string, source: SitemapSource) => {
    if (seen.has(url) || queue.length + files.length >= limits.maxFiles) {
      if (seen.has(url)) return;
      partial = true;
      return;
    }
    seen.add(url);
    queue.push({ url, source });
  };

  const robotsUrl =
    import.meta.env.FIREFOX && options.networkPurpose !== "site-crawl"
      ? ""
      : (await import("./sitemap-network")).robotsAddress(page.origin);
  if (!robotsUrl)
    return {
      schemaVersion: 1,
      siteOrigin: page.origin,
      pageUrl: options.pageUrl,
      partial,
      cancelled,
      files,
    };
  const robots = await readUrl(robotsUrl, page.origin, options.signal, options.fetcher, limits);
  if (robots === "aborted") cancelled = true;
  else if (
    robots &&
    robots !== "external" &&
    robots.status === 200 &&
    !looksLikeHtml(robots.type, robots.text)
  ) {
    for (const url of sitemapDirectives(robots.text, robotsUrl))
      classify(url, "robots", page.origin, push, files);
  }

  if (!cancelled) {
    for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
      const url = new URL(path, page.origin).href;
      if (![...seen, ...files.map((file) => file.url)].includes(url)) push(url, "conventional");
    }
    if (options.userUrl?.trim()) {
      const user = absoluteHttp(options.userUrl.trim(), page.origin);
      if (!user) {
        files.push(emptyFile(options.userUrl.trim(), "user", "failed", "unknown"));
      } else {
        classify(user, "user", page.origin, push, files);
      }
    }
  }

  while (queue.length && !cancelled && files.length < limits.maxFiles) {
    const next = queue.shift();
    if (!next) break;
    const loaded = await readUrl(next.url, page.origin, options.signal, options.fetcher, limits);
    if (loaded === "aborted") {
      cancelled = true;
      partial = true;
      break;
    }
    if (loaded === "external") {
      files.push(emptyFile(next.url, next.source, "external", ""));
      continue;
    }
    if (!loaded) {
      files.push(emptyFile(next.url, next.source, "failed", ""));
      continue;
    }
    if (loaded.status === 404) {
      files.push(emptyFile(next.url, next.source, "missing", ""));
      continue;
    }
    if (loaded.status < 200 || loaded.status >= 300) {
      files.push(emptyFile(next.url, next.source, "failed", ""));
      continue;
    }
    const record = await recordFromBytes(
      next.url,
      next.source,
      "fetched",
      loaded.bytes,
      loaded.type,
      urlsLeft,
      limits.maxBytes,
    );
    urlsLeft -= record.entries.length;
    if (record.truncated || loaded.truncated) {
      record.truncated = true;
      partial = true;
    }
    files.push(record);
    if (record.kind === "index" && next.source !== "child") {
      for (const child of record.children) {
        classify(child, "child", page.origin, push, files);
      }
    }
  }
  if (queue.length) partial = true;

  return {
    schemaVersion: 1,
    siteOrigin: page.origin,
    pageUrl: options.pageUrl,
    partial: partial || cancelled,
    cancelled,
    files,
  };
}

function classify(
  url: string,
  source: SitemapSource,
  origin: string,
  push: (url: string, source: SitemapSource) => void,
  files: SitemapFileRecord[],
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    files.push(emptyFile(url, source, "failed", "unknown"));
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    files.push(emptyFile(url, source, "failed", "unknown"));
    return;
  }
  if (parsed.origin !== origin) {
    files.push(emptyFile(parsed.href, source, "external", ""));
    return;
  }
  push(parsed.href, source);
}

async function recordFromBytes(
  url: string,
  source: SitemapSource,
  fetchState: SitemapFetch,
  bytes: Uint8Array,
  contentType: string | null,
  urlsLeft: number,
  maxBytes: number,
): Promise<SitemapFileRecord> {
  let truncated = bytes.byteLength > maxBytes;
  let body = truncated ? bytes.slice(0, maxBytes) : bytes;
  if (looksGzip(body, contentType, url)) {
    const inflated = await inflateGzip(body, maxBytes);
    if (inflated === "unsupported") {
      return { ...emptyFile(url, source, fetchState, "gzip"), truncated };
    }
    body = inflated.bytes;
    truncated = truncated || inflated.truncated;
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(body);
  if (looksLikeHtml(contentType, text)) return emptyFile(url, source, "failed", "unknown");
  const extracted = extractSitemap(text, Math.max(0, urlsLeft));
  return {
    url,
    source,
    fetch: fetchState,
    kind: extracted.kind,
    truncated: truncated || extracted.truncated,
    entries: extracted.entries,
    children: extracted.children,
  };
}

function emptyFile(
  url: string,
  source: SitemapSource,
  fetchState: SitemapFetch,
  kind: SitemapFileRecord["kind"],
): SitemapFileRecord {
  return { url, source, fetch: fetchState, kind, truncated: false, entries: [], children: [] };
}

function absoluteHttp(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function looksLikeHtml(contentType: string | null, body: string): boolean {
  if (contentType?.toLowerCase().includes("text/html")) return true;
  const start = body.trimStart().slice(0, 20).toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}

async function readUrl(
  url: string,
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch | undefined,
  limits: Limits,
): Promise<
  | { status: number; type: string | null; text: string; bytes: Uint8Array; truncated: boolean }
  | "aborted"
  | "external"
  | null
> {
  if (signal.aborted) return "aborted";
  const request = fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    let current = url;
    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      const target = new URL(current);
      if (target.protocol !== "http:" && target.protocol !== "https:") return null;
      if (target.origin !== origin) return "external";
      const response = await request(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || hop === limits.maxRedirects) return null;
        current = new URL(location, current).href;
        continue;
      }
      const read = await readLimited(response, limits.maxBytes);
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        text: read.text,
        bytes: read.bytes,
        truncated: read.truncated,
      };
    }
    return null;
  } catch {
    return signal.aborted ? "aborted" : null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; bytes: Uint8Array; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (size < maxBytes) {
    const step = await reader.read();
    if (step.done) break;
    const room = maxBytes - size;
    const piece = step.value.byteLength > room ? step.value.slice(0, room) : step.value;
    chunks.push(piece);
    size += piece.byteLength;
    if (step.value.byteLength > room) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), bytes, truncated };
}

export function sitemapUrlsCsv(files: SitemapFileRecord[]): string {
  return toCsv(
    ["url", "sitemap", "lastmod", "changefreq", "priority"],
    files.flatMap((file) =>
      file.entries.map((entry) => [
        entry.loc,
        file.url,
        entry.lastmod,
        entry.changefreq,
        entry.priority,
      ]),
    ),
  );
}

export function sitemapFindingsCsv(
  findings: Array<{
    id: string;
    status: string;
    title: string;
    description: string;
    evidence: Array<{ value: string }>;
  }>,
): string {
  return toCsv(
    ["id", "status", "title", "description", "evidence"],
    findings.map((item) => [
      item.id,
      item.status,
      item.title,
      item.description,
      item.evidence.map((entry) => entry.value).join(" | "),
    ]),
  );
}
