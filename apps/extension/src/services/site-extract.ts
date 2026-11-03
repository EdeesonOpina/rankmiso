import type { CrawlPage } from "./site-crawl";
import { crawlUrl, inCrawlScope } from "./site-crawl";

const MAX_LINKS = 200;
const MAX_HEADINGS = 40;
const MAX_META_TAGS = 100;
const MAX_TEXT = 20_000;

export function extractCrawlPage(html: string, pageUrl: string): CrawlPage {
  const document = new DOMParser().parseFromString(html, "text/html");
  const titleElements = Array.from(document.querySelectorAll("title"));
  const title = (titleElements[0]?.textContent || "").trim();
  const descriptionElements = Array.from(document.querySelectorAll('meta[name="description" i]'));
  const description = (descriptionElements[0]?.getAttribute("content") || "").trim();
  const robots = meta(document, "robots");
  const canonicalElements = Array.from(document.querySelectorAll('link[rel~="canonical" i]'));
  const canonicalHref = canonicalElements[0]?.getAttribute("href") ?? "";
  const canonical = canonicalHref ? (crawlUrl(canonicalHref, pageUrl) ?? "") : "";
  const headings = Array.from(document.querySelectorAll("h1")).slice(0, MAX_HEADINGS);
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0, MAX_LINKS);
  const internal: string[] = [];
  const internalDetails: NonNullable<CrawlPage["internalLinkDetails"]> = [];
  let external = 0;
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const resolved = crawlUrl(href, pageUrl);
    if (!resolved) continue;
    if (inCrawlScope(pageUrl, resolved)) {
      if (!internal.includes(resolved)) internal.push(resolved);
      internalDetails.push({
        url: resolved,
        rel: (link.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean),
        anchorText: (link.textContent || link.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 200),
        target: link.getAttribute("target") || "",
      });
    } else external += 1;
  }
  const noindex = /\bnoindex\b/i.test(robots);
  return {
    url: pageUrl,
    finalUrl: pageUrl,
    status: null,
    contentType: "text/html",
    title,
    titleState: titleElements.length === 0 ? "missing" : title ? "present" : "empty",
    description,
    descriptionState:
      descriptionElements.length === 0 ? "missing" : description ? "present" : "empty",
    canonical,
    canonicalCount: canonicalElements.length,
    robots,
    h1Count: headings.length,
    internalLinks: internal,
    internalLinkDetails: internalDetails,
    internalLinksTruncated: document.querySelectorAll("a[href]").length > MAX_LINKS,
    imageCount: Math.min(document.querySelectorAll("img").length, 200),
    structuredDataCount: document.querySelectorAll('script[type="application/ld+json"]').length,
    structuredDataTruncated:
      document.querySelectorAll('script[type="application/ld+json"]').length > 8,
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

function numberAttribute(element: Element, name: string): number | null {
  const raw = element.getAttribute(name);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function snapshotFromHtml(
  html: string,
  pageUrl: string,
  status: number,
  contentType: string,
) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const page = extractCrawlPage(html, pageUrl);
  const metaTags = Array.from(document.querySelectorAll("meta")).slice(0, MAX_META_TAGS);
  return {
    schemaVersion: 1,
    url: pageUrl,
    collectedAt: new Date().toISOString(),
    titles: {
      rendered: page.titleState === "missing" ? null : page.title,
      elements: Array.from(document.querySelectorAll("title"))
        .slice(0, 8)
        .map((item) => (item.textContent || "").trim()),
    },
    meta: metaTags.map((tag) => ({
      name: tag.getAttribute("name"),
      property: tag.getAttribute("property"),
      httpEquiv: tag.getAttribute("http-equiv"),
      content: tag.getAttribute("content"),
      charset: tag.getAttribute("charset"),
    })),
    linksRel: Array.from(document.querySelectorAll('link[rel~="canonical" i]'))
      .slice(0, 8)
      .map((link) => ({
        rel: "canonical",
        href: link.getAttribute("href") || "",
        hreflang: link.getAttribute("hreflang"),
      })),
    headings: Array.from(document.querySelectorAll("h1, h2, h3"))
      .slice(0, MAX_HEADINGS)
      .map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: (heading.textContent || "").trim(),
        location: "crawl",
      })),
    links: Array.from(document.querySelectorAll("a[href]"))
      .slice(0, MAX_LINKS)
      .map((link) => {
        const href = link.getAttribute("href") || "";
        let resolvedUrl: string | null = null;
        try {
          resolvedUrl = new URL(href, pageUrl).href;
        } catch {
          /* unresolved links remain observations */
        }
        return {
          href,
          resolvedUrl,
          accessibleName: (link.textContent || link.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200),
          rel: (link.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean),
          target: link.getAttribute("target"),
          title: link.getAttribute("title"),
          location: "crawl",
        };
      }),
    images: Array.from(document.querySelectorAll("img"))
      .slice(0, 200)
      .map((image) => ({
        src: image.getAttribute("src"),
        altPresent: image.hasAttribute("alt"),
        altValue: image.getAttribute("alt") || "",
        widthAttr: numberAttribute(image, "width"),
        heightAttr: numberAttribute(image, "height"),
        renderedWidth: null,
        renderedHeight: null,
        naturalWidth: null,
        naturalHeight: null,
        loading: image.getAttribute("loading"),
        fetchPriority: image.getAttribute("fetchpriority"),
        srcset: image.getAttribute("srcset"),
        decoding: image.getAttribute("decoding"),
        sizes: image.getAttribute("sizes"),
        inPicture: image.parentElement?.tagName === "PICTURE",
        broken: null,
        location: "crawl",
      })),
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
