import { shallowReactive } from "vue";
import type { AccessCheck } from "./crawler-access";
import type { RenderingReport } from "./rendering-engine";

/**
 * Latest crawler-access and HTML-comparison results per page URL, in memory for this report
 * page only. Content readiness reads them; it never runs those network checks itself.
 * Nothing is persisted, and the oldest entries are dropped past the cap.
 */
const MAX_PAGES = 20;

export interface RenderingResult {
  checkedAt: string;
  report: RenderingReport;
}

const crawler = shallowReactive(new Map<string, AccessCheck>());
const rendering = shallowReactive(new Map<string, RenderingResult>());

function remember<T>(map: Map<string, T>, url: string, value: T) {
  map.delete(url);
  map.set(url, value);
  while (map.size > MAX_PAGES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function rememberCrawlerAccess(url: string, check: AccessCheck) {
  remember(crawler, url, check);
}

export function rememberRendering(url: string, report: RenderingReport, checkedAt: string) {
  remember(rendering, url, { report, checkedAt });
}

export function crawlerAccessFor(url: string): AccessCheck | undefined {
  return crawler.get(url);
}

export function renderingFor(url: string): RenderingResult | undefined {
  return rendering.get(url);
}
