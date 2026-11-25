import { shallowReactive } from "vue";
import { appConfig } from "../config/app.config";
import type { AccessCheck } from "./crawler-access";
import type { RenderingReport } from "./rendering-engine";

/**
 * Latest crawler-access and HTML-comparison results per page URL. Content readiness and
 * Overview read them; they never run those network checks themselves.
 *
 * Crawler-access results are also kept in this extension's localStorage, which the popup,
 * sidebar, and report share, so a check made in one stays visible in the others and after a
 * restart. They never leave the device, the oldest pages are dropped past the cap, and
 * Settings → reset clears them. HTML comparisons stay in memory for the open page only.
 */
const MAX_PAGES = 20;
const MAX_STORED_BYTES = 1_500_000;
const KEY = appConfig.crawlerAccessKey;

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
  persist();
}

function looksLikeCheck(value: unknown): value is AccessCheck {
  const item = value as Partial<AccessCheck> | null;
  return (
    !!item &&
    typeof item.checkedAt === "string" &&
    typeof item.robotsUrl === "string" &&
    !!item.report &&
    Array.isArray(item.report.agents)
  );
}

/** Stored entries, oldest first. Unreadable data is ignored, never trusted. */
export function readStoredCrawlerAccess(): Array<[string, AccessCheck]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is [string, AccessCheck] =>
          Array.isArray(entry) && typeof entry[0] === "string" && looksLikeCheck(entry[1]),
      )
      .slice(-MAX_PAGES);
  } catch {
    return [];
  }
}

function persist() {
  try {
    let entries = [...crawler.entries()];
    let text = JSON.stringify(entries);
    while (text.length > MAX_STORED_BYTES && entries.length > 1) {
      entries = entries.slice(1);
      text = JSON.stringify(entries);
    }
    localStorage.setItem(KEY, text);
  } catch {
    // Storage can be full or blocked; the result still shows in this window.
  }
}

function hydrate(prune = false) {
  const stored = readStoredCrawlerAccess();
  // Only a cleared store removes results; a failed write elsewhere must not hide this one.
  if (prune && !stored.length) crawler.clear();
  for (const [url, check] of stored) {
    const current = crawler.get(url);
    if (!current || current.checkedAt < check.checkedAt) remember(crawler, url, check);
  }
}

if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
  hydrate();
  // A check finished in another RankMiso window (popup, sidebar, or report).
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) hydrate(event.newValue === null);
  });
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
