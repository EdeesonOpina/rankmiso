import { analyze_crawler_access } from "../wasm/pkg/seo_wasm.js";
import { crawlers } from "../config/crawlers.config";
import { ensureEngine } from "./engine";
import { CRAWL_LIMITS, crawlUrl, inCrawlScope } from "./site-crawl";
import { readBody, readRobots } from "./site-crawl-network";

/** The page is read once for its status, X-Robots-Tag, and initial-HTML meta tags. */
const PAGE_MAX_BYTES = 512_000;
const MAX_META = 400;

export type RobotsState = "read" | "missing" | "error" | "not-read";
export type CrawlState =
  "allowed" | "disallowed" | "no-rules" | "robots-missing" | "robots-error" | "not-measured";
export type PageAccess =
  | "ok"
  | "auth-required"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "server-error"
  | "other"
  | "not-measured";

export interface Directive {
  value: string;
  source: string;
}

export interface AgentVerdict {
  id: string;
  token: string;
  crawl: CrawlState;
  group: string | null;
  rule: string | null;
  viaWildcard: boolean;
  indexingState: "read" | "not-measured";
  indexing: Directive[];
}

export interface AccessReport {
  schemaVersion: number;
  path: string;
  pageAccess: PageAccess;
  pageStatus: number | null;
  agents: AgentVerdict[];
  microsoft: {
    state: "read" | "not-measured";
    training: Directive | null;
    grounding: Directive | null;
    inEffect: boolean;
  };
}

export interface PageObservation {
  state: "read" | "not-read";
  status: number | null;
  xRobotsTag: string[];
  meta: Array<{ name: string; content: string }>;
  reason: "" | "redirect" | "timeout" | "network" | "aborted";
}

export interface AccessCheck {
  checkedAt: string;
  robotsUrl: string;
  robotsState: RobotsState;
  robotsStatus: number | null;
  page: PageObservation;
  report: AccessReport;
}

/**
 * Reads robots.txt and the page once each (two requests, same origin, no cookies), then asks
 * the Rust engine what the observed rules say to each registered crawler. The caller must
 * already hold site access for the origin.
 */
export async function checkCrawlerAccess(
  pageUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<AccessCheck> {
  const origin = new URL(pageUrl).origin;
  const [robots, page] = await Promise.all([
    readRobots(origin, signal, fetcher),
    observePage(pageUrl, origin, signal, fetcher),
  ]);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const robotsState = robotsStateOf(robots);
  const checkedAt = now().toISOString();
  await ensureEngine();
  const report = JSON.parse(
    analyze_crawler_access(
      JSON.stringify({
        schemaVersion: 1,
        pageUrl,
        checkedAt,
        robots: { state: robotsState, status: robots.status, body: robots.body },
        page: {
          state: page.state,
          status: page.status,
          xRobotsTag: page.xRobotsTag,
          meta: page.meta,
        },
        agents: crawlers.map((entry) => ({ id: entry.id, token: entry.token })),
      }),
    ),
  ) as AccessReport;
  return {
    checkedAt,
    robotsUrl: new URL("/robots.txt", origin).href,
    robotsState,
    robotsStatus: robots.status,
    page,
    report,
  };
}

/**
 * RFC 9309 §2.3.1: a 4xx (other than 429) means no rules; 5xx and 429 mean crawlers should
 * assume everything is disallowed. A request this browser could not make says nothing about
 * crawlers, so it stays `not-read`, never "allowed".
 */
export function robotsStateOf(robots: {
  status: number | null;
  unavailable: boolean;
}): RobotsState {
  const { status } = robots;
  if (status === null) return "not-read";
  if (status === 429 || status >= 500) return "error";
  if (status >= 400) return "missing";
  return robots.unavailable ? "not-read" : "read";
}

/** Fetches the page without cookies and follows redirects only inside the origin. */
export async function observePage(
  pageUrl: string,
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<PageObservation> {
  const failed = (reason: PageObservation["reason"]): PageObservation => ({
    state: "not-read",
    status: null,
    xRobotsTag: [],
    meta: [],
    reason,
  });
  if (signal.aborted) return failed("aborted");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_LIMITS.timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    let current = pageUrl;
    for (let hop = 0; hop <= CRAWL_LIMITS.maxRedirects; hop += 1) {
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.type === "opaqueredirect" || response.status === 0) return failed("redirect");
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const next = crawlUrl(response.headers.get("location") ?? "", current);
        if (!next || !inCrawlScope(origin, next)) return failed("redirect");
        current = next;
        continue;
      }
      const header = response.headers.get("x-robots-tag");
      const type = response.headers.get("content-type") ?? "";
      let meta: PageObservation["meta"] = [];
      if (type.toLowerCase().includes("html")) {
        const read = await readBody(response, PAGE_MAX_BYTES);
        meta = metaDirectives(read.text);
      } else {
        await response.body?.cancel();
      }
      return {
        state: "read",
        status: response.status,
        xRobotsTag: header ? [header] : [],
        meta,
        reason: "",
      };
    }
    return failed("redirect");
  } catch {
    if (signal.aborted) return failed("aborted");
    return failed(controller.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Named meta tags from the initial HTML. The document is parsed, never run. */
export function metaDirectives(html: string): Array<{ name: string; content: string }> {
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.querySelectorAll("meta[name][content]"))
    .slice(0, MAX_META)
    .map((tag) => ({
      name: tag.getAttribute("name")?.trim() ?? "",
      content: tag.getAttribute("content")?.trim() ?? "",
    }))
    .filter((tag) => tag.name && tag.content);
}
