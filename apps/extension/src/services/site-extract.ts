import type { CrawlPage } from "./site-crawl";
import { crawlUrl, inCrawlScope } from "./site-crawl";

const MAX_LINKS = 200;
const MAX_HEADINGS = 40;
const MAX_TEXT = 20_000;

export function extractCrawlPage(html: string, pageUrl: string): CrawlPage {
  const document = new DOMParser().parseFromString(html, "text/html");
  const title = (document.title || "").trim();
  const description = meta(document, "description");
  const robots = meta(document, "robots");
  const canonicalHref =
    document.querySelector('link[rel~="canonical" i]')?.getAttribute("href") ?? "";
  const canonical = canonicalHref ? (crawlUrl(canonicalHref, pageUrl) ?? "") : "";
  const headings = Array.from(document.querySelectorAll("h1")).slice(0, MAX_HEADINGS);
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0, MAX_LINKS);
  const internal: string[] = [];
  let external = 0;
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const resolved = crawlUrl(href, pageUrl);
    if (!resolved) continue;
    if (inCrawlScope(pageUrl, resolved)) {
      if (!internal.includes(resolved)) internal.push(resolved);
    } else external += 1;
  }
  const noindex = /\bnoindex\b/i.test(robots);
  return {
    url: pageUrl,
    finalUrl: pageUrl,
    status: null,
    contentType: "text/html",
    title,
    description,
    canonical,
    robots,
    h1Count: headings.length,
    internalLinks: internal,
    externalLinks: external,
    indexability: robots ? (noindex ? "noindex" : "indexable") : "unknown",
    issues: [],
    error: "",
    skipped: "",
    redirectHops: [],
    fromSitemap: false,
    depth: 0,
  };
}

function meta(document: Document, name: string): string {
  return document.querySelector(`meta[name="${name}" i]`)?.getAttribute("content")?.trim() ?? "";
}

export function snapshotFromHtml(
  html: string,
  pageUrl: string,
  status: number,
  contentType: string,
) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const page = extractCrawlPage(html, pageUrl);
  return {
    schemaVersion: 1,
    url: pageUrl,
    collectedAt: new Date().toISOString(),
    titles: { rendered: page.title || null, elements: page.title ? [page.title] : [] },
    meta: [
      page.description
        ? {
            name: "description",
            property: null,
            httpEquiv: null,
            content: page.description,
            charset: null,
          }
        : null,
      page.robots
        ? { name: "robots", property: null, httpEquiv: null, content: page.robots, charset: null }
        : null,
    ].filter((tag) => tag !== null),
    linksRel: page.canonical ? [{ rel: "canonical", href: page.canonical, hreflang: null }] : [],
    headings: Array.from(document.querySelectorAll("h1, h2, h3"))
      .slice(0, MAX_HEADINGS)
      .map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: (heading.textContent || "").trim(),
        location: "crawl",
      })),
    links: page.internalLinks.slice(0, MAX_LINKS).map((href) => ({
      href,
      resolvedUrl: href,
      accessibleName: href,
      rel: [],
      target: null,
      title: null,
      location: "crawl",
    })),
    images: [],
    content: {
      visibleText: (document.body?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TEXT),
      textTruncated: false,
      htmlLength: html.length,
      paragraphCount: document.querySelectorAll("p").length,
      htmlLang: document.documentElement.lang || null,
      publishedTime: null,
      modifiedTime: null,
    },
    structuredData: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .slice(0, 8)
      .map((script) => ({ format: "json-ld", raw: (script.textContent || "").slice(0, 100_000) })),
    accessibility: {
      unlabeledFormControls: 0,
      namelessButtons: 0,
      duplicateIds: 0,
      sampled: false,
    },
    performance: {
      lcpMs: null,
      cls: null,
      inpMs: null,
      domContentLoadedMs: null,
      loadEventMs: null,
      transferSize: null,
      resourceCount: null,
      notes: ["Crawl HTML is source text, not a rendered page."],
    },
    response: {
      status,
      redirectCount: 0,
      contentType,
      headersAvailable: false,
      headers: [],
    },
    site: {
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
      hreflangSkipped: 0,
      notes: [],
    },
    collection: {
      method: "crawl-html",
      domGeneration: 0,
      limitations: ["CRAWL_SOURCE_HTML"],
    },
  };
}
