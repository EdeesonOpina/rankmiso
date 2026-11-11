import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "../src/config/app.config";
import {
  clearCrawl,
  loadCrawl,
  saveCrawl,
  type CrawlPage,
  type CrawlSession,
} from "../src/services/site-crawl";
import {
  clearComparisonHistory,
  clearUnreadableHistory,
  deleteSnapshot,
  readHistory,
  saveSnapshot,
  snapshotsForOrigin,
} from "../src/services/site-history";

const origin = "https://example.test";

function page(url: string): CrawlPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html",
    title: "Page",
    description: "Description",
    canonical: "",
    robots: "",
    h1Count: 1,
    analyzed: true,
    internalLinks: [],
    internalLinkDetails: [],
    externalLinks: 0,
    indexability: "unknown",
    issues: [],
    findings: [],
    error: "",
    skipped: "",
    redirectHops: [],
    fromSitemap: false,
    depth: 0,
  };
}

function session(pages: CrawlPage[] = [page(`${origin}/`)]): CrawlSession {
  return {
    id: "crawl",
    startUrl: `${origin}/`,
    origin,
    scope: "host",
    status: "complete",
    startedAt: "2026-11-01T00:00:00.000Z",
    finishedAt: "2026-11-01T00:01:00.000Z",
    partial: false,
    robots: "read",
    sitemap: "empty",
    sitemapUrls: 0,
    pages,
    duplicates: [],
    orphans: [],
    note: "",
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("comparison history", () => {
  it("saves an explicit snapshot and leaves the latest crawl session in place", () => {
    saveCrawl(session());
    const saved = saveSnapshot(session(), "0.6.0", "1.0.0", "2026-11-09T00:00:00.000Z");
    expect(saved.ok).toBe(true);
    expect(loadCrawl(origin)?.origin).toBe(origin);
    expect(snapshotsForOrigin(origin)).toHaveLength(1);
    expect(JSON.stringify(snapshotsForOrigin(origin)[0])).not.toContain("<html");
  });

  it("keeps at most five snapshots for one origin and does not drop another origin", () => {
    for (let index = 0; index < 5; index += 1) {
      expect(
        saveSnapshot(session(), "0.6.0", "1.0.0", `2026-11-0${index + 1}T00:00:00.000Z`).ok,
      ).toBe(true);
    }
    const other = saveSnapshot(
      {
        ...session([page("https://other.test/")]),
        origin: "https://other.test",
        startUrl: "https://other.test/",
      },
      "0.6.0",
      "1.0.0",
    );
    expect(other.ok).toBe(true);
    const refused = saveSnapshot(session(), "0.6.0", "1.0.0");
    expect(refused).toEqual({ ok: false, reason: "origin-full" });
    expect(snapshotsForOrigin(origin)).toHaveLength(5);
    expect(snapshotsForOrigin("https://other.test")).toHaveLength(1);
  });

  it("deletes one snapshot and skips corrupted records without throwing", () => {
    const saved = saveSnapshot(session(), "0.6.0", "1.0.0");
    if (!saved.ok) throw new Error("snapshot was not saved");
    localStorage.setItem(
      appConfig.siteCrawlHistoryKey,
      JSON.stringify({
        schemaVersion: 1,
        records: [saved.snapshot, { broken: true }, { schemaVersion: 2, id: "future" }],
      }),
    );
    const history = readHistory();
    expect(history.corruptStore).toBe(false);
    expect(history.snapshots).toHaveLength(1);
    expect(history.unreadable).toBe(2);
    expect(deleteSnapshot(saved.snapshot.id)).toBe(true);
    expect(readHistory().snapshots).toHaveLength(0);
    expect(readHistory().unreadable).toBe(2);
    localStorage.setItem(appConfig.siteCrawlHistoryKey, "{");
    expect(readHistory()).toMatchObject({ corruptStore: true, snapshots: [] });
    expect(saveSnapshot(session(), "0.6.0", "1.0.0")).toEqual({ ok: false, reason: "corrupt" });
    clearUnreadableHistory();
    expect(localStorage.getItem(appConfig.siteCrawlHistoryKey)).toBeNull();
  });

  it("reports a storage quota failure and keeps the previous history", () => {
    const saved = saveSnapshot(session(), "0.6.0", "1.0.0");
    expect(saved.ok).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(saveSnapshot(session(), "0.6.0", "1.0.0")).toEqual({ ok: false, reason: "quota" });
    vi.restoreAllMocks();
    expect(readHistory().snapshots).toHaveLength(1);
  });

  it("refuses a save that would exceed the history budget", () => {
    const huge = session(
      Array.from({ length: 100 }, (_, index) => ({
        ...page(`${origin}/${index}`),
        description: "d".repeat(2_000),
        internalLinks: Array.from(
          { length: 50 },
          (_unused, link) => `${origin}/l/${index}-${link}`,
        ),
      })),
    );
    const first = saveSnapshot(huge, "0.6.0", "1.0.0");
    expect(first.ok).toBe(true);
    const raw = localStorage.getItem(appConfig.siteCrawlHistoryKey) ?? "";
    const records = JSON.parse(raw).records as unknown[];
    const paddedRecord = { ...(records[0] as object), pad: "x".repeat(400_000) };
    localStorage.setItem(
      appConfig.siteCrawlHistoryKey,
      JSON.stringify({
        schemaVersion: 1,
        records: [paddedRecord, paddedRecord, paddedRecord, paddedRecord],
      }),
    );
    const refused = saveSnapshot(huge, "0.6.0", "1.0.0");
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.reason).toBe("budget");
    expect(loadCrawl(origin)).toBeNull();
    clearCrawl();
    clearComparisonHistory();
    expect(localStorage.getItem(appConfig.siteCrawlKey)).toBeNull();
  });

  it("still loads an older latest-session record that has no comparison snapshot", () => {
    localStorage.setItem(
      appConfig.siteCrawlKey,
      JSON.stringify({
        origin,
        pages: [{ url: `${origin}/old`, internalLinks: [`${origin}/a`] }],
      }),
    );
    expect(loadCrawl(origin)?.pages[0]?.url).toBe(`${origin}/old`);
    expect(readHistory().snapshots).toHaveLength(0);
  });
});
