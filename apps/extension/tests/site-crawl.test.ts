import process from "node:process";
import { describe, expect, it, vi } from "vitest";
import {
  CRAWL_LIMITS,
  crawlUrl,
  duplicateMetadata,
  filterPages,
  inCrawlScope,
  isPrivateHostname,
  runSiteCrawl,
  sessionCsv,
  sortPages,
  type CrawlPage,
  type FetchResult,
} from "../src/services/site-crawl";
import { extractCrawlPage } from "../src/services/site-extract";
import { fetchCrawlPage, readRobots } from "../src/services/site-crawl-network";

const start = "http://127.0.0.1/index.html";

function ok(url: string, html = "<html><title>Page</title></html>"): FetchResult {
  return {
    status: 200,
    finalUrl: url,
    contentType: "text/html",
    html,
    hops: [],
    error: "",
    truncated: false,
    retryable: false,
  };
}

describe("site crawl", () => {
  it("keeps the reviewed shared crawl budgets", () => {
    expect(CRAWL_LIMITS).toEqual({
      maxPages: 100,
      maxDepth: 3,
      concurrency: 2,
      timeoutMs: 10_000,
      maxBytes: 1_000_000,
      maxRedirects: 5,
      maxDurationMs: 120_000,
      maxDiscovered: 400,
      retries: 1,
    });
  });

  it("keeps query identity and drops fragments", () => {
    expect(crawlUrl("/products?page=1#top", "https://Example.com/a")).toBe(
      "https://example.com/products?page=1",
    );
    expect(crawlUrl("/products?page=2", "https://example.com/a")).not.toBe(
      crawlUrl("/products?page=1", "https://example.com/a"),
    );
    expect(crawlUrl("mailto:ada@example.com", start)).toBeNull();
    expect(crawlUrl("javascript:void(0)", start)).toBeNull();
  });

  it("stays on the starting origin and refuses a private hop from a public site", () => {
    expect(inCrawlScope("https://example.com/a", "https://example.com/b")).toBe(true);
    expect(inCrawlScope("https://example.com/a", "https://www.example.com/b")).toBe(false);
    expect(inCrawlScope("http://example.com/a", "https://example.com/a")).toBe(false);
    expect(inCrawlScope("https://example.com/a", "http://127.0.0.1/secret")).toBe(false);
    expect(inCrawlScope("http://127.0.0.1/a", "http://127.0.0.1/b")).toBe(true);
    expect(isPrivateHostname("10.1.1.1")).toBe(true);
    expect(isPrivateHostname("example.com")).toBe(false);
    expect(isPrivateHostname("fe90::1")).toBe(true);
    expect(isPrivateHostname("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateHostname("[::ffff:8.8.8.8]")).toBe(false);
    expect(isPrivateHostname("999.1.1.1")).toBe(false);
  });

  it("caps robots redirects at the shared redirect limit", async () => {
    let requests = 0;
    const result = await readRobots(
      "https://example.com",
      new AbortController().signal,
      async () => {
        requests += 1;
        return new Response(null, { status: 302, headers: { location: "/loop" } });
      },
    );
    expect(requests).toBe(6);
    expect(result.unavailable).toBe(true);
  });

  it("stops the whole crawl when its duration deadline expires during robots", async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    try {
      let sitemapDiscovery = 0;
      const session = await runSiteCrawl({
        startUrl: start,
        signal: new AbortController().signal,
        readRobots: async (signal) => {
          expect(signal.aborted).toBe(false);
          deadline.abort();
          expect(signal.aborted).toBe(true);
          return { status: 404, body: "", unavailable: false };
        },
        discoverSitemaps: async () => {
          sitemapDiscovery += 1;
          return { urls: [], unavailable: false, empty: true };
        },
        mayFetch: async () => true,
        fetchPage: async (url) => ok(url),
        inspect: async (page) => page,
      });
      expect(session.status).toBe("complete");
      expect(session.partial).toBe(true);
      expect(session.note).toContain("time limit");
      expect(sitemapDiscovery).toBe(0);
    } finally {
      timeout.mockRestore();
    }
  });

  it("times out a hanging robots request and aborts its fetch signal", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const pending = readRobots(
        "https://example.com",
        new AbortController().signal,
        (_url, init) => {
          requestSignal = init?.signal as AbortSignal;
          return new Promise<Response>((_resolve, reject) => {
            requestSignal?.addEventListener("abort", () => reject(new Error("request timed out")), {
              once: true,
            });
          });
        },
      );
      await vi.advanceTimersByTimeAsync(CRAWL_LIMITS.timeoutMs);
      const result = await pending;
      expect(requestSignal?.aborted).toBe(true);
      expect(result.unavailable).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fetch when robots.txt cannot be read", async () => {
    let fetches = 0;
    const session = await runSiteCrawl({
      startUrl: start,
      signal: new AbortController().signal,
      readRobots: async () => ({ status: null, body: "", unavailable: true }),
      discoverSitemaps: async () => ({ urls: [], unavailable: false, empty: true }),
      mayFetch: async () => true,
      fetchPage: async (url) => {
        fetches += 1;
        return ok(url);
      },
      inspect: async (page) => page,
    });
    expect(fetches).toBe(0);
    expect(session.robots).toBe("unavailable");
    expect(session.pages[0]?.skipped).toContain("unavailable");
    expect(session.sitemap).toBe("not-read");
  });

  it("skips a disallowed path and keeps sitemap URLs in scope", async () => {
    const fetched: string[] = [];
    const session = await runSiteCrawl({
      startUrl: start,
      signal: new AbortController().signal,
      readRobots: async () => ({ status: 200, body: "rules", unavailable: false }),
      discoverSitemaps: async () => ({
        urls: ["http://127.0.0.1/from-map", "https://other.example/out"],
        unavailable: false,
        empty: false,
      }),
      mayFetch: async (path) => path !== "/secret",
      fetchPage: async (url) => {
        fetched.push(url);
        const html = url.endsWith("index.html")
          ? '<html><a href="/secret">Secret</a><a href="/next">Next</a><a href="https://example.com/out">Out</a></html>'
          : "<html></html>";
        return ok(url, html);
      },
      inspect: async (page, html) => extractCrawlPage(html, page.url),
    });
    expect(fetched).toContain(start);
    expect(fetched).toContain("http://127.0.0.1/from-map");
    expect(fetched).toContain("http://127.0.0.1/next");
    expect(fetched).not.toContain("http://127.0.0.1/secret");
    expect(fetched.some((url) => url.includes("example.com"))).toBe(false);
    expect(session.pages.some((page) => page.skipped.includes("disallows"))).toBe(true);
  });

  it("stops when the signal aborts and retries a 429 once", async () => {
    const controller = new AbortController();
    let calls = 0;
    const stopped = runSiteCrawl({
      startUrl: start,
      signal: controller.signal,
      readRobots: async () => ({ status: 404, body: "", unavailable: false }),
      discoverSitemaps: async () => ({ urls: [], unavailable: false, empty: true }),
      mayFetch: async () => true,
      fetchPage: async (url) => {
        calls += 1;
        if (calls === 1) controller.abort();
        return ok(url);
      },
      inspect: async (page) => page,
    });
    const session = await stopped;
    expect(session.status).toBe("stopped");
    expect(session.orphans).toEqual([]);

    let tries = 0;
    await runSiteCrawl({
      startUrl: start,
      signal: new AbortController().signal,
      limits: { retries: 1 },
      readRobots: async () => ({ status: 404, body: "", unavailable: false }),
      discoverSitemaps: async () => ({ urls: [], unavailable: false, empty: true }),
      mayFetch: async () => true,
      fetchPage: async (url) => {
        tries += 1;
        if (tries === 1) {
          return { ...ok(url, ""), status: 429, html: "", error: "HTTP 429", retryable: true };
        }
        return ok(url, "<html><title>After</title></html>");
      },
      inspect: async (page, html) => ({ ...extractCrawlPage(html, page.url), status: page.status }),
    });
    expect(tries).toBe(2);
  });

  it("does not retry after Stop during the transient-failure delay", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      let tries = 0;
      const crawling = runSiteCrawl({
        startUrl: start,
        signal: controller.signal,
        limits: { retries: 1 },
        readRobots: async () => ({ status: 404, body: "", unavailable: false }),
        discoverSitemaps: async () => ({ urls: [], unavailable: false, empty: true }),
        mayFetch: async () => true,
        fetchPage: async (url) => {
          tries += 1;
          return { ...ok(url, ""), status: 503, html: "", error: "HTTP 503", retryable: true };
        },
        inspect: async (page) => page,
      });
      await vi.waitFor(() => expect(tries).toBe(1));
      controller.abort();
      await vi.advanceTimersByTimeAsync(500);
      const session = await crawling;
      expect(tries).toBe(1);
      expect(session.status).toBe("stopped");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start a page request when Stop arrives during robots policy evaluation", async () => {
    const controller = new AbortController();
    let releasePolicy: (() => void) | undefined;
    let policyStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      policyStarted = resolve;
    });
    let fetches = 0;
    const crawling = runSiteCrawl({
      startUrl: start,
      signal: controller.signal,
      readRobots: async () => ({ status: 200, body: "User-agent: *", unavailable: false }),
      discoverSitemaps: async () => ({ urls: [], unavailable: false, empty: true }),
      mayFetch: () => {
        policyStarted?.();
        return new Promise<boolean>((resolve) => {
          releasePolicy = () => resolve(true);
        });
      },
      fetchPage: async (url) => {
        fetches += 1;
        return ok(url);
      },
      inspect: async (page) => page,
    });

    await started;
    controller.abort();
    releasePolicy?.();
    const session = await crawling;

    expect(fetches).toBe(0);
    expect(session.status).toBe("stopped");
    expect(session.partial).toBe(true);
  });

  it("does not dispatch a page fetch when passed an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    let requests = 0;
    const result = await fetchCrawlPage(start, start, controller.signal, async () => {
      requests += 1;
      return new Response("unexpected");
    });

    expect(requests).toBe(0);
    expect(result.error).toBe("Stopped");
  });

  it("omits credentials and referrers while manually validating redirects", async () => {
    let request: RequestInit | undefined;
    const result = await fetchCrawlPage(
      start,
      start,
      new AbortController().signal,
      async (_input, init) => {
        request = init;
        return new Response("<!doctype html><title>Local</title>", {
          headers: { "content-type": "text/html" },
        });
      },
    );

    expect(request).toMatchObject({
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(result.html).toContain("<title>Local</title>");
  });

  it("limits page redirects to five followed hops", async () => {
    let requests = 0;
    const result = await fetchCrawlPage(start, start, new AbortController().signal, async () => {
      requests += 1;
      return new Response(null, { status: 302, headers: { location: "/next" } });
    });
    expect(requests).toBe(6);
    expect(result.error).toContain("could not be followed");
  });

  it("groups duplicate titles without calling them duplicate content", () => {
    const pages = [
      page("http://127.0.0.1/a", "Same Title", "One"),
      page("http://127.0.0.1/b", " same   title ", "Two"),
      page("http://127.0.0.1/c", "", ""),
    ];
    const groups = duplicateMetadata(pages);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("title");
    expect(groups[0]?.urls).toHaveLength(2);
  });

  it("filters, sorts, and prefixes formula text in CSV", () => {
    const pages = [page("http://127.0.0.1/b", "=cmd", ""), page("http://127.0.0.1/a", "Alpha", "")];
    pages[1]?.issues.push("Missing title");
    const filtered = filterPages(pages, "alpha", "issues");
    expect(filtered.map((item) => item.url)).toEqual(["http://127.0.0.1/a"]);
    expect(sortPages(pages, "url").map((item) => item.url)[0]).toBe("http://127.0.0.1/a");
    expect(sessionCsv({ ...emptyish(), pages })).toContain("'=cmd");
    expect(filterPages(pages, "missing-name", "all")).toEqual([]);
  });

  it.skipIf(process.env.RANKMISO_RUN_PERF !== "1")(
    "crawls 100 and 500 local pages inside the cap",
    async () => {
      const hundredRuns = [];
      const fiveHundredRuns = [];
      for (let sample = 0; sample < 5; sample += 1) {
        hundredRuns.push(await timedCrawl(100));
        fiveHundredRuns.push(await timedCrawl(500));
      }
      const hundred = hundredRuns[0];
      const fiveHundred = fiveHundredRuns[0];
      if (!hundred || !fiveHundred) throw new Error("The crawl benchmark did not produce samples.");
      expect(hundred.pages.filter((item) => item.status === 200)).toHaveLength(100);
      expect(fiveHundred.pages.filter((item) => item.status === 200)).toHaveLength(500);
      expect(fiveHundred.partial).toBe(true);
      console.log(
        `fixture crawl timings (ms, n=5): 100 pages ${JSON.stringify(timingSummary(hundredRuns.map((run) => run.ms)))}; 500 pages ${JSON.stringify(timingSummary(fiveHundredRuns.map((run) => run.ms)))}`,
      );
    },
    60_000,
  );
});

function timingSummary(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function timedCrawl(count: number) {
  const started = Date.now();
  const urls = Array.from({ length: count }, (_, index) => `http://127.0.0.1/p${index.toString()}`);
  const session = await runSiteCrawl({
    startUrl: urls[0] ?? start,
    signal: new AbortController().signal,
    limits: { maxPages: count, maxDiscovered: count + 5 },
    readRobots: async () => ({ status: 404, body: "", unavailable: false }),
    discoverSitemaps: async () => ({ urls: urls.slice(1), unavailable: false, empty: false }),
    mayFetch: async () => true,
    fetchPage: async (url) => ok(url, `<html><title>Page ${url}</title><h1>One</h1></html>`),
    inspect: async (page, html) => extractCrawlPage(html, page.finalUrl),
  });
  return { pages: session.pages, partial: session.partial, ms: Date.now() - started };
}

function page(url: string, title: string, description: string): CrawlPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html",
    title,
    description,
    canonical: url,
    robots: "",
    h1Count: 1,
    internalLinks: [],
    externalLinks: 0,
    indexability: "unknown",
    issues: [],
    error: "",
    skipped: "",
    redirectHops: [],
    fromSitemap: false,
    depth: 0,
  };
}

function emptyish() {
  return {
    id: "1",
    startUrl: start,
    origin: "http://127.0.0.1",
    scope: "This host only",
    status: "complete" as const,
    startedAt: "",
    finishedAt: "",
    partial: false,
    robots: "missing" as const,
    sitemap: "empty" as const,
    sitemapUrls: 0,
    duplicates: [],
    orphans: [],
    note: "",
  };
}
