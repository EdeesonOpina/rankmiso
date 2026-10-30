import process from "node:process";
import { gzipSync } from "node:zlib";
import { DecompressionStream } from "node:stream/web";
import { describe, expect, it } from "vitest";
import { extractSitemap, inflateGzip } from "../src/services/sitemap-xml";
import {
  collectSitemaps,
  sitemapDirectives,
  sitemapUrlsCsv,
} from "../src/services/sitemap-explore";

const page = "https://example.com/guide";

function xmlResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "application/xml", ...headers } });
}

describe("sitemap extraction", () => {
  it.skipIf(process.env.RANKMISO_RUN_PERF !== "1")(
    "records repeatable parsing time for a 1,000 URL fixture",
    () => {
      const xml = `<urlset>${Array.from(
        { length: 1_000 },
        (_, index) =>
          `<url><loc>https://example.com/page-${index.toString()}</loc><lastmod>2026-10-30</lastmod></url>`,
      ).join("")}</urlset>`;
      const samples: number[] = [];
      for (let sample = 0; sample < 5; sample += 1) {
        const started = performance.now();
        const result = extractSitemap(xml, 1_000);
        samples.push(performance.now() - started);
        expect(result.entries).toHaveLength(1_000);
      }
      const sorted = [...samples].sort((left, right) => left - right);
      console.log(
        `1,000 URL sitemap parse timings (ms, n=5): median ${sorted[2]?.toFixed(2)}; min ${sorted[0]?.toFixed(2)}; max ${sorted[4]?.toFixed(2)}`,
      );
    },
  );

  it("reads a urlset and an index", () => {
    const urls = extractSitemap(
      `<urlset><url><loc>https://example.com/guide</loc><lastmod>2026-10-27</lastmod></url></urlset>`,
      10,
    );
    expect(urls.kind).toBe("urlset");
    expect(urls.entries[0]?.loc).toBe("https://example.com/guide");
    const index = extractSitemap(
      `<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap></sitemapindex>`,
      10,
    );
    expect(index.children).toEqual(["https://example.com/a.xml"]);
  });

  it("rejects a DTD before using the body as a sitemap", () => {
    const extracted = extractSitemap(
      `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><urlset><url><loc>&xxe;</loc></url></urlset>`,
      10,
    );
    expect(extracted.kind).toBe("dtd");
    expect(extracted.entries).toEqual([]);
  });

  it("rejects malformed and non-sitemap XML", () => {
    expect(extractSitemap("<urlset>", 10).kind).toBe("invalid");
    expect(extractSitemap("<html><body>no</body></html>", 10).kind).toBe("unknown");
  });

  it("stops at the entry limit", () => {
    const extracted = extractSitemap(
      `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`,
      1,
    );
    expect(extracted.entries).toHaveLength(1);
    expect(extracted.truncated).toBe(true);
  });

  it("opens gzip without a compression dependency", async () => {
    Object.assign(globalThis, { DecompressionStream });
    const xml = "<urlset><url><loc>https://example.com/guide</loc></url></urlset>";
    const opened = await inflateGzip(gzipSync(xml), 20_000);
    expect(opened).not.toBe("unsupported");
    if (opened === "unsupported") return;
    expect(new TextDecoder().decode(opened.bytes)).toContain("https://example.com/guide");
  });
});

describe("sitemap discovery", () => {
  it("reads every Sitemap directive and does not request another host", async () => {
    const seen: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith("/robots.txt")) {
        return xmlResponse(
          "Sitemap: https://example.com/sitemap.xml\nSitemap: https://cdn.example/other.xml\nSitemap: /posts.xml\n",
          200,
          { "content-type": "text/plain" },
        );
      }
      if (url.endsWith("/sitemap.xml")) {
        return xmlResponse(`<urlset><url><loc>${page}</loc></url></urlset>`);
      }
      if (url.endsWith("/posts.xml") || url.endsWith("/sitemap_index.xml")) {
        return xmlResponse("<urlset></urlset>", 404);
      }
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;

    const result = await collectSitemaps({
      pageUrl: page,
      signal: new AbortController().signal,
      network: true,
      fetcher,
      limits: { maxFiles: 4 },
    });
    expect(seen.some((url) => url.includes("cdn.example"))).toBe(false);
    expect(
      result.files.some((file) => file.url.includes("cdn.example") && file.fetch === "external"),
    ).toBe(true);
    expect(
      result.files.some(
        (file) => file.url.endsWith("/sitemap.xml") && file.entries[0]?.loc === page,
      ),
    ).toBe(true);
    expect(
      result.files.some((file) => file.source === "conventional" && file.fetch === "missing"),
    ).toBe(true);
  });

  it("does not follow a redirect off the approved origin", async () => {
    const seen: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith("/robots.txt"))
        return xmlResponse("", 404, { "content-type": "text/plain" });
      if (url.endsWith("/sitemap.xml")) {
        return new Response("", {
          status: 302,
          headers: { location: "https://evil.example/secret.xml" },
        });
      }
      if (url.endsWith("/sitemap_index.xml")) return xmlResponse("", 404);
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;
    const result = await collectSitemaps({
      pageUrl: page,
      signal: new AbortController().signal,
      network: true,
      fetcher,
      limits: { maxFiles: 2 },
    });
    expect(seen.some((url) => url.includes("evil.example"))).toBe(false);
    expect(
      result.files.some((file) => file.url.endsWith("/sitemap.xml") && file.fetch === "external"),
    ).toBe(true);
  });

  it("stops when the caller cancels", async () => {
    const controller = new AbortController();
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      controller.abort();
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return new Response("late");
    }) as typeof fetch;
    const result = await collectSitemaps({
      pageUrl: page,
      signal: controller.signal,
      network: true,
      fetcher,
    });
    expect(result.cancelled).toBe(true);
    expect(result.partial).toBe(true);
  });

  it("does not dispatch a sitemap request when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let requests = 0;
    const result = await collectSitemaps({
      pageUrl: page,
      signal: controller.signal,
      network: true,
      fetcher: (async () => {
        requests += 1;
        return xmlResponse("<urlset></urlset>");
      }) as typeof fetch,
    });

    expect(requests).toBe(0);
    expect(result.cancelled).toBe(true);
    expect(result.partial).toBe(true);
  });

  it("marks a short file budget as partial", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return xmlResponse(
          "Sitemap: https://example.com/a.xml\nSitemap: https://example.com/b.xml\n",
          200,
          {
            "content-type": "text/plain",
          },
        );
      }
      return xmlResponse("<urlset><url><loc>https://example.com/a</loc></url></urlset>");
    }) as typeof fetch;
    const result = await collectSitemaps({
      pageUrl: page,
      signal: new AbortController().signal,
      network: true,
      fetcher,
      limits: { maxFiles: 1 },
    });
    expect(result.partial).toBe(true);
    expect(result.files.filter((file) => file.fetch === "fetched")).toHaveLength(1);
  });

  it("imports a local file without a network request", async () => {
    const result = await collectSitemaps({
      pageUrl: page,
      signal: new AbortController().signal,
      network: false,
      imported: [
        {
          name: "local.xml",
          bytes: new TextEncoder().encode(
            `<urlset><url><loc>${page}</loc></url><url><loc>=1+1</loc></url></urlset>`,
          ),
        },
      ],
      fetcher: (() => {
        throw new Error("network");
      }) as typeof fetch,
    });
    expect(result.files[0]?.fetch).toBe("imported");
    expect(result.files[0]?.entries).toHaveLength(2);
    expect(sitemapUrlsCsv(result.files)).toContain(`"'=1+1"`);
  });
});

describe("sitemap directives", () => {
  it("keeps multiple declarations and resolves a relative one", () => {
    expect(
      sitemapDirectives(
        "Sitemap: https://example.com/a.xml\nSitemap: /b.xml\n",
        "https://example.com/robots.txt",
      ),
    ).toEqual(["https://example.com/a.xml", "https://example.com/b.xml"]);
  });
});
