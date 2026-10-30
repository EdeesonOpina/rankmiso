import { crawlPermitted } from "./engine";
import { collectSitemaps } from "./sitemap-explore";
import { crawlUrl, inCrawlScope, type FetchResult } from "./site-crawl";
import { CRAWL_LIMITS } from "./site-crawl";

export function robotsUrl(origin: string): string {
  return new URL("/robots.txt", origin).href;
}

export async function readRobots(
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const loaded = await readLimitedUrl(robotsUrl(origin), origin, signal, fetcher);
  if (loaded === "aborted") return { status: null, body: "", unavailable: true };
  if (!loaded || loaded === "external") return { status: null, body: "", unavailable: true };
  if (loaded.status === 404) return { status: 404, body: "", unavailable: false };
  if (loaded.status !== 200 || looksLikeHtml(loaded.type, loaded.text)) {
    return { status: loaded.status, body: "", unavailable: true };
  }
  return { status: loaded.status, body: loaded.text, unavailable: false };
}

export async function discoverSitemapUrls(
  pageUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const collection = await collectSitemaps({
    pageUrl,
    signal,
    network: true,
    networkPurpose: "site-crawl",
    fetcher,
  });
  const fetched = collection.files.filter((file) => file.fetch === "fetched");
  const failed = collection.files.filter((file) => file.fetch === "failed");
  const urls = fetched.flatMap((file) => file.entries.map((entry) => entry.loc));
  return {
    urls,
    unavailable: fetched.length === 0 && failed.length > 0,
    empty: fetched.length > 0 && urls.length === 0,
  };
}

export async function mayFetchPath(body: string, path: string): Promise<boolean> {
  return crawlPermitted(body, path);
}

export async function fetchCrawlPage(
  url: string,
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<FetchResult> {
  if (signal.aborted) {
    return {
      status: null,
      finalUrl: url,
      contentType: "",
      html: "",
      hops: [],
      error: "Stopped",
      truncated: false,
      retryable: false,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_LIMITS.timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    let current = url;
    const hops: string[] = [];
    for (let hop = 0; hop <= CRAWL_LIMITS.maxRedirects; hop += 1) {
      if (!inCrawlScope(origin, current)) {
        return {
          status: null,
          finalUrl: current,
          contentType: "",
          html: "",
          hops,
          error: "A redirect left this host and was not followed.",
          truncated: false,
          retryable: false,
        };
      }
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.type === "opaqueredirect" || response.status === 0) {
        await response.body?.cancel();
        return {
          status: 0,
          finalUrl: current,
          contentType: "",
          html: "",
          hops,
          error: "The redirect could not be checked, so it was not followed.",
          truncated: false,
          retryable: false,
        };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        const next = location ? crawlUrl(location, current) : null;
        if (!next || hop === CRAWL_LIMITS.maxRedirects) {
          return {
            status: response.status,
            finalUrl: current,
            contentType: "",
            html: "",
            hops,
            error: "The redirect could not be followed inside this host.",
            truncated: false,
            retryable: false,
          };
        }
        hops.push(next);
        current = next;
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      const read = await readBody(response, CRAWL_LIMITS.maxBytes);
      const retryable = response.status === 429 || response.status === 503;
      const html = type.includes("html") || looksLikeHtml(type, read.text) ? read.text : "";
      return {
        status: response.status,
        finalUrl: current,
        contentType: type,
        html,
        hops,
        error: response.status >= 400 ? `HTTP ${response.status.toString()}` : "",
        truncated: read.truncated,
        retryable,
      };
    }
    return {
      status: null,
      finalUrl: current,
      contentType: "",
      html: "",
      hops,
      error: "Too many redirects.",
      truncated: false,
      retryable: false,
    };
  } catch {
    return {
      status: null,
      finalUrl: url,
      contentType: "",
      html: "",
      hops: [],
      error: signal.aborted ? "Stopped" : "The request failed.",
      truncated: false,
      retryable: !signal.aborted,
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readLimitedUrl(
  url: string,
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
) {
  if (signal.aborted) return "aborted" as const;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_LIMITS.timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    if (signal.aborted) onAbort();
    let current = url;
    for (let hop = 0; hop <= CRAWL_LIMITS.maxRedirects; hop += 1) {
      if (controller.signal.aborted) return "aborted" as const;
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const next = crawlUrl(response.headers.get("location") ?? "", current);
        await response.body?.cancel();
        if (!next || !inCrawlScope(origin, next)) return "external" as const;
        if (hop === CRAWL_LIMITS.maxRedirects) return null;
        current = next;
        continue;
      }
      const read = await readBody(response, 80_000);
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        text: read.text,
      };
    }
    return null;
  } catch {
    return signal.aborted || controller.signal.aborted ? ("aborted" as const) : null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readBody(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", truncated: false };
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
  return { text: new TextDecoder().decode(bytes), truncated };
}

function looksLikeHtml(contentType: string | null, body: string): boolean {
  if (contentType?.toLowerCase().includes("html")) return true;
  const start = body.trimStart().slice(0, 20).toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}
