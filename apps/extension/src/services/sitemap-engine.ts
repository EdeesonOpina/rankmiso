import { analyze_sitemap } from "../wasm/pkg/seo_wasm.js";
import type { CheckResult } from "../types/audit";
import { ensureEngine } from "./engine";
import type { SitemapDocument } from "./sitemap-explore";

export interface SitemapReport {
  schemaVersion: number;
  pageMatch: "found" | "absent" | "unknown" | "unchecked";
  urlCount: number;
  fileCount: number;
  partial: boolean;
  findings: CheckResult[];
}

export async function analyzeSitemap(document: SitemapDocument): Promise<SitemapReport> {
  await ensureEngine();
  const json = analyze_sitemap(JSON.stringify(document));
  return JSON.parse(json) as SitemapReport;
}
