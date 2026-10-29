import { describe, expect, it } from "vitest";
import {
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

  it("crawls 100 and 500 local pages inside the cap", async () => {
    const hundred = await timedCrawl(100);
    const fiveHundred = await timedCrawl(500);
    expect(hundred.pages.filter((item) => item.status === 200)).toHaveLength(100);
    expect(fiveHundred.pages.filter((item) => item.status === 200)).toHaveLength(500);
    expect(fiveHundred.partial).toBe(true);
    console.log(`crawl 100 ms ${hundred.ms} crawl 500 ms ${fiveHundred.ms}`);
  });
});

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
