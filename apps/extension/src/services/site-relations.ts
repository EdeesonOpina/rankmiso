import { analyze_site_relations } from "../wasm/pkg/seo_wasm.js";
import type { CheckResult } from "../types/audit";
import { ensureEngine } from "./engine";
import type { CrawlSession } from "./site-crawl";

export interface SiteRelationsReport {
  schemaVersion: number;
  findings: CheckResult[];
}

/**
 * Canonical and hreflang relationships across one crawl, judged by the Rust engine. Only pages
 * this crawl requested are used; nothing is fetched here.
 */
export async function analyzeSiteRelations(session: CrawlSession): Promise<SiteRelationsReport> {
  await ensureEngine();
  const input = {
    schemaVersion: 1,
    origin: session.origin,
    partial: session.partial || session.status !== "complete",
    pages: session.pages.map((page) => ({
      url: page.url,
      finalUrl: page.finalUrl || page.url,
      status: page.status,
      analyzed: page.analyzed ?? (!page.error && !page.skipped && !page.nonHtml),
      canonical: page.canonical,
      noindex: page.indexability === "noindex",
      hreflang: page.hreflang ?? null,
      hreflangTruncated: page.hreflangTruncated ?? false,
    })),
  };
  return JSON.parse(analyze_site_relations(JSON.stringify(input))) as SiteRelationsReport;
}
