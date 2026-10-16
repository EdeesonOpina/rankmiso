import type { PageSnapshot } from "../types/audit";

export interface SiteProbe {
  requested: boolean;
  robotsStatus: number | null;
  robotsBody: string;
  sitemapUrls: string[];
  sitemapStatus: number | null;
  sitemapUrlCount: number | null;
  sitemapContainsPage: boolean | null;
  sitemapTruncated: boolean;
  linksChecked: number;
  linksTotal: number;
  linksBroken: number;
  linksUnreachable: number;
  linksBlocked: number;
  redirectHops: string[];
  hreflangChecked: number;
  hreflangMissing: number;
  notes: string[];
}

const HEADER_NAMES = [
  "content-type",
  "x-robots-tag",
  "cache-control",
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "location",
  "link",
] as const;

const LINK_SAMPLE = 20;

export function emptySiteProbe(): SiteProbe {
  return {
    requested: false,
    robotsStatus: null,
    robotsBody: "",
    sitemapUrls: [],
    sitemapStatus: null,
    sitemapUrlCount: null,
    sitemapContainsPage: null,
    sitemapTruncated: false,
    linksChecked: 0,
    linksTotal: 0,
    linksBroken: 0,
    linksUnreachable: 0,
    linksBlocked: 0,
    redirectHops: [],
    hreflangChecked: 0,
    hreflangMissing: 0,
    notes: [],
  };
}

export function isBlockedProbeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(host);
  if (mapped?.[1]) return isPrivateV4(mapped[1]);
  return isPrivateV4(host);
}

export function sitemapUrlsFromRobots(body: string, robotsUrl: string): string[] {
  const urls: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const match = /^sitemap\s*:\s*(.+)$/i.exec(line);
    const value = match?.[1]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value, robotsUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (isBlockedProbeHost(url.hostname)) continue;
      urls.push(url.href);
    } catch {
      continue;
    }
    if (urls.length >= 8) break;
  }
  return urls;
}

export function collectHeaders(headers: Headers): Array<{ name: string; value: string }> {
  const collected: Array<{ name: string; value: string }> = [];
  for (const name of HEADER_NAMES) {
    const value = headers.get(name);
    if (!value) continue;
    collected.push({ name, value: value.slice(0, 180) });
  }
  return collected;
}

export function samePage(left: string, right: string): boolean {
  try {
    const target = new URL(right);
    const current = new URL(left, target);
    const pathOf = (url: URL) => (url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, ""));
    return (
      current.protocol === target.protocol &&
      current.host === target.host &&
      pathOf(current) === pathOf(target) &&
      current.search === target.search
    );
  } catch {
    return false;
  }
}

export function pageListedInSitemap(xml: string, pageUrl: string): boolean {
  const locs = xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi);
  for (const loc of locs) {
    const value = loc[1];
    if (value && samePage(value, pageUrl)) return true;
  }
  return false;
}

export function alternatePointsBack(html: string, pageUrl: string): boolean {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    if (!/\brel\s*=\s*["'][^"']*\balternate\b[^"']*["']/i.test(tag)) return false;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    return href != null && samePage(href, pageUrl);
  });
}

export async function probeSite(
  snapshot: PageSnapshot,
  options: { linkOffset?: number; linksOnly?: boolean } = {},
): Promise<PageSnapshot> {
  if (options.linksOnly && snapshot.site?.requested) {
    return continueLinks(snapshot, options.linkOffset ?? snapshot.site.linksChecked);
  }
  const notes: string[] = [];
  const site = emptySiteProbe();
  site.requested = true;
  const response = {
    status: snapshot.response?.status ?? null,
    redirectCount: snapshot.response?.redirectCount ?? null,
    contentType: snapshot.response?.contentType ?? null,
    headersAvailable: snapshot.response?.headersAvailable ?? false,
    headers: snapshot.response?.headers ?? [],
  };

  const page = await fetchText(snapshot.url, 1);
  if (page && page.status > 0) {
    response.headersAvailable = true;
    response.headers = page.headers;
    site.redirectHops = page.hops;
    if (!response.contentType && page.contentType) response.contentType = page.contentType;
    notes.push("Headers are a fresh fetch from this browser, not the original navigation.");
  } else {
    notes.push("Response headers could not be read.");
  }

  const robotsUrl = new URL("/robots.txt", snapshot.url).href;
  const robots = await fetchText(robotsUrl, 80_000);
  if (!robots) {
    notes.push("robots.txt could not be fetched.");
  } else if (robots.status === 404) {
    site.robotsStatus = 404;
  } else if (looksLikeHtml(robots.contentType, robots.text)) {
    notes.push("The robots.txt response looked like HTML and was ignored.");
  } else {
    site.robotsStatus = robots.status;
    site.robotsBody = robots.text;
    if (robots.truncated) notes.push("robots.txt was cut off at 80,000 characters.");
  }

  const sitemapUrls = sitemapUrlsFromRobots(site.robotsBody, robotsUrl);
  site.sitemapUrls = sitemapUrls;
  const firstSitemap = sitemapUrls[0];
  if (sitemapUrls.length > 1) notes.push("Only the first listed sitemap was fetched.");
  if (firstSitemap) {
    const sitemap = await fetchText(firstSitemap, 200_000);
    if (!sitemap) {
      notes.push("The first sitemap could not be fetched.");
    } else {
      site.sitemapStatus = sitemap.status;
      if (sitemap.status === 200) {
        site.sitemapUrlCount = (sitemap.text.match(/<loc\b/gi) ?? []).length;
        site.sitemapTruncated = sitemap.truncated;
        site.sitemapContainsPage = pageListedInSitemap(sitemap.text, snapshot.url);
        if (sitemap.truncated) notes.push("The sitemap was cut off before the count finished.");
      }
    }
  }

  const links = snapshot.links ?? [];
  if (links.some((link) => skippedPrivate(link.href || link.resolvedUrl || "", snapshot.url))) {
    notes.push("Local and private addresses were skipped.");
  }
  const publicLinks = listPublicLinks(links, snapshot.url);
  site.linksTotal = publicLinks.length;
  const candidates = publicLinks.slice(0, LINK_SAMPLE);
  if (publicLinks.length > candidates.length) {
    notes.push("Only the first 20 public http(s) links were requested.");
  }
  const outcomes = await mapPool(candidates, 3, classifyLink);
  site.linksChecked = outcomes.length;
  site.linksBroken = outcomes.filter((item) => item === "broken").length;
  site.linksUnreachable = outcomes.filter((item) => item === "unreachable").length;
  site.linksBlocked = outcomes.filter((item) => item === "blocked").length;
  await checkHreflang(snapshot, site, notes);
  site.notes = notes.slice(0, 12);
  return { ...snapshot, response, site };
}

async function continueLinks(snapshot: PageSnapshot, offset: number): Promise<PageSnapshot> {
  const site = { ...(snapshot.site ?? emptySiteProbe()) };
  const notes = [...site.notes];
  const publicLinks = listPublicLinks(snapshot.links ?? [], snapshot.url);
  site.linksTotal = publicLinks.length;
  const candidates = publicLinks.slice(offset, offset + LINK_SAMPLE);
  const outcomes = await mapPool(candidates, 3, classifyLink);
  site.linksChecked += outcomes.length;
  site.linksBroken += outcomes.filter((item) => item === "broken").length;
  site.linksUnreachable += outcomes.filter((item) => item === "unreachable").length;
  site.linksBlocked += outcomes.filter((item) => item === "blocked").length;
  notes.push("Another 20 public links were requested.");
  site.notes = notes.slice(0, 12);
  return { ...snapshot, site };
}

async function checkHreflang(
  snapshot: PageSnapshot,
  site: SiteProbe,
  notes: string[],
): Promise<void> {
  const alternates = (snapshot.linksRel ?? [])
    .filter((link) => link.rel.toLowerCase().split(/\s+/).includes("alternate") && link.hreflang)
    .map((link) => {
      try {
        return new URL(link.href, snapshot.url).href;
      } catch {
        return "";
      }
    })
    .filter((href) => href && !samePage(href, snapshot.url) && !isBlockedHref(href));
  const unique = [...new Set(alternates)];
  if (unique.length > 8) notes.push("Only the first 8 hreflang alternates were fetched.");
  for (const href of unique.slice(0, 8)) {
    const page = await fetchText(href, 100_000);
    site.hreflangChecked += 1;
    if (!page || page.status >= 400 || !alternatePointsBack(page.text, snapshot.url)) {
      site.hreflangMissing += 1;
    }
  }
}

function isBlockedHref(href: string): boolean {
  try {
    return isBlockedProbeHost(new URL(href).hostname);
  } catch {
    return true;
  }
}

function isPrivateV4(host: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  return a === 172 && b >= 16 && b <= 31;
}

function looksLikeHtml(contentType: string | null, body: string): boolean {
  if (contentType?.toLowerCase().includes("text/html")) return true;
  const start = body.trimStart().slice(0, 20).toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html");
}

function listPublicLinks(links: NonNullable<PageSnapshot["links"]>, pageUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const link of links) {
    const resolved = publicHttpUrl(link.resolvedUrl || link.href, pageUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    urls.push(resolved);
  }
  return urls;
}

function skippedPrivate(raw: string, pageUrl: string): boolean {
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return isBlockedProbeHost(url.hostname);
  } catch {
    return false;
  }
}

function publicHttpUrl(raw: string, pageUrl: string): string | null {
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedProbeHost(url.hostname)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Math.min(limit, items.length);
  async function worker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await task(item);
    }
  }
  if (workers === 0) return [];
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function classifyLink(url: string): Promise<"ok" | "broken" | "blocked" | "unreachable"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    let result = await requestPublic(url, "HEAD", controller.signal);
    if (result === "failed") return "unreachable";
    if (result.response.status === 405 || result.response.status === 501) {
      await result.response.body?.cancel();
      result = await requestPublic(url, "GET", controller.signal);
      if (result === "failed") return "unreachable";
    }
    const status = result.response.status;
    await result.response.body?.cancel();
    if (status === 401 || status === 403 || status === 429) return "blocked";
    if (status >= 400) return "broken";
    if (status >= 200 && status < 300) return "ok";
    return "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(
  url: string,
  maxChars: number,
): Promise<{
  status: number;
  contentType: string | null;
  text: string;
  truncated: boolean;
  headers: Array<{ name: string; value: string }>;
  hops: string[];
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const result = await requestPublic(url, "GET", controller.signal);
    if (result === "failed") return null;
    const limited = await readLimited(result.response, maxChars);
    return {
      status: result.response.status,
      contentType: result.response.headers.get("content-type"),
      text: limited.text,
      truncated: limited.truncated,
      headers: collectHeaders(result.response.headers),
      hops: result.hops,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function requestPublic(
  url: string,
  method: "GET" | "HEAD",
  signal: AbortSignal,
): Promise<{ response: Response; hops: string[] } | "failed"> {
  const hops: string[] = [];
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    const next = new URL(current);
    if (
      (next.protocol !== "http:" && next.protocol !== "https:") ||
      isBlockedProbeHost(next.hostname)
    ) {
      return "failed";
    }
    const response = await fetch(current, {
      method,
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      hops.push(`${response.status} ${current}`);
      await response.body?.cancel();
      if (!location) return { response, hops };
      current = new URL(location, current).href;
      continue;
    }
    return { response, hops };
  }
  return "failed";
}

async function readLimited(
  response: Response,
  maxChars: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", truncated: false };
  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;
  while (text.length < maxChars) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length >= maxChars) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  text += decoder.decode();
  return { text: text.slice(0, maxChars), truncated };
}
