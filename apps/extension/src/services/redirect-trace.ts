import { analyze_redirects } from "../wasm/pkg/seo_wasm.js";
import type { CheckResult } from "../types/audit";
import { ensureEngine } from "./engine";
import type { RedirectObserver } from "./redirect-observer";
import { CRAWL_LIMITS } from "./site-crawl";
import { readBody } from "./site-crawl-network";
import { isBlockedProbeHost } from "./site-probe";

const MAX_HOPS = 10;
const MAX_BYTES = 512_000;

export interface RedirectHop {
  url: string;
  status: number;
  location: string;
}

export type TraceStop =
  | ""
  | "loop"
  | "limit"
  | "left-origin"
  | "blocked"
  | "unreadable"
  | "timeout"
  | "network"
  | "aborted";

export interface RedirectTrace {
  schemaVersion: 1;
  startUrl: string;
  checkedAt: string;
  /** True when each hop's status and Location could be read (webRequest permission). */
  hopsObserved: boolean;
  hops: RedirectHop[];
  /** Set only when the chain ended in a response RankMiso read. */
  finalUrl: string | null;
  finalStatus: number | null;
  /** A redirect was seen, even if its hops could not be read. */
  redirected: boolean;
  stopped: TraceStop;
  metaRefresh: { delay: number; url: string } | null;
  canonical: string;
}

export interface RedirectReport {
  schemaVersion: number;
  findings: CheckResult[];
}

/**
 * Follows redirects from `startUrl` one hop at a time, without cookies, inside `origin`. A
 * redirect is followed only when its Location was read and validated; otherwise the trace stops
 * and says why. The final page is read (up to 512 KB) for meta refresh and canonical only.
 */
export async function traceRedirects(
  startUrl: string,
  origin: string,
  signal: AbortSignal,
  observer: RedirectObserver | null,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<RedirectTrace> {
  const trace: RedirectTrace = {
    schemaVersion: 1,
    startUrl,
    checkedAt: now().toISOString(),
    hopsObserved: observer !== null,
    hops: [],
    finalUrl: null,
    finalStatus: null,
    redirected: false,
    stopped: "",
    metaRefresh: null,
    canonical: "",
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_LIMITS.timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  const visited = new Set<string>();
  let current = startUrl;
  try {
    for (let hop = 0; ; hop += 1) {
      if (visited.has(current)) {
        trace.stopped = "loop";
        return trace;
      }
      if (hop > MAX_HOPS) {
        trace.stopped = "limit";
        return trace;
      }
      visited.add(current);
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      let status = response.status;
      let location = response.headers.get("location");
      if (response.type === "opaqueredirect" || status === 0) {
        trace.redirected = true;
        const observed = observer ? await observer.read(current) : null;
        if (!observed) {
          trace.stopped = "unreadable";
          return trace;
        }
        status = observed.status;
        location = observed.location;
      }
      if (status >= 300 && status < 400) {
        await response.body?.cancel();
        trace.redirected = true;
        let next: URL;
        try {
          next = new URL(location ?? "", current);
        } catch {
          trace.stopped = "unreadable";
          return trace;
        }
        trace.hops.push({ url: current, status, location: next.href });
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          trace.stopped = "blocked";
          return trace;
        }
        if (next.origin !== origin) {
          trace.stopped = "left-origin";
          return trace;
        }
        if (isBlockedProbeHost(next.hostname) && next.hostname !== new URL(startUrl).hostname) {
          trace.stopped = "blocked";
          return trace;
        }
        next.hash = "";
        current = next.href;
        continue;
      }
      trace.finalUrl = current;
      trace.finalStatus = status;
      const type = response.headers.get("content-type") ?? "";
      if (type.toLowerCase().includes("html")) {
        const read = await readBody(response, MAX_BYTES);
        readFinalPage(read.text, current, trace);
      } else {
        await response.body?.cancel();
      }
      return trace;
    }
  } catch {
    trace.stopped = signal.aborted ? "aborted" : controller.signal.aborted ? "timeout" : "network";
    return trace;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Meta refresh and canonical from the final HTML. The document is parsed, never run. */
function readFinalPage(html: string, url: string, trace: RedirectTrace) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const refresh = Array.from(document.querySelectorAll("meta[http-equiv]")).find(
    (tag) => tag.getAttribute("http-equiv")?.toLowerCase() === "refresh",
  );
  const content = refresh?.getAttribute("content") ?? "";
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:[;,]\s*(?:url\s*=\s*)?['"]?([^'"]*)['"]?)?/i.exec(
    content,
  );
  if (refresh && match) {
    let target = "";
    try {
      target = match[2] ? new URL(match[2].trim(), url).href : "";
    } catch {
      target = match[2] ?? "";
    }
    trace.metaRefresh = { delay: Math.round(Number(match[1])), url: target };
  }
  const canonical = document.querySelector('link[rel~="canonical" i][href]')?.getAttribute("href");
  if (canonical) {
    try {
      trace.canonical = new URL(canonical, url).href;
    } catch {
      trace.canonical = canonical;
    }
  }
}

export async function analyzeRedirects(trace: RedirectTrace): Promise<RedirectReport> {
  await ensureEngine();
  return JSON.parse(analyze_redirects(JSON.stringify(trace))) as RedirectReport;
}
