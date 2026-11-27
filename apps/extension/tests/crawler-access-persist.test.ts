import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessCheck } from "../src/services/crawler-access";

const KEY = "rankmiso.crawlerAccess";

function check(checkedAt: string): AccessCheck {
  return {
    checkedAt,
    robotsUrl: "https://example.com/robots.txt",
    robotsState: "read",
    robotsStatus: 200,
    page: {} as AccessCheck["page"],
    report: { agents: [{ id: "gptbot", crawl: "disallowed" }] } as unknown as AccessCheck["report"],
  };
}

async function freshStore() {
  vi.resetModules();
  return import("../src/services/ai-search-store");
}

describe("stored crawler access", () => {
  beforeEach(() => localStorage.clear());

  it("keeps a check for later windows and restarts", async () => {
    const first = await freshStore();
    first.rememberCrawlerAccess("https://example.com/a", check("2026-11-25T01:00:00.000Z"));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1);

    const later = await freshStore();
    expect(later.crawlerAccessFor("https://example.com/a")?.checkedAt).toBe(
      "2026-11-25T01:00:00.000Z",
    );
    expect(later.crawlerAccessFor("https://example.com/b")).toBeUndefined();
  });

  it("ignores damaged or foreign data", async () => {
    localStorage.setItem(KEY, "{not json");
    expect((await freshStore()).readStoredCrawlerAccess()).toEqual([]);
    localStorage.setItem(
      KEY,
      JSON.stringify([
        ["https://example.com/", { checkedAt: 5 }],
        ["https://example.com/ok", check("2026-11-25T02:00:00.000Z")],
        "junk",
      ]),
    );
    const store = await freshStore();
    expect(store.readStoredCrawlerAccess().map(([url]) => url)).toEqual(["https://example.com/ok"]);
    expect(store.crawlerAccessFor("https://example.com/")).toBeUndefined();
  });

  it("keeps at most 20 pages, dropping the oldest", async () => {
    const store = await freshStore();
    for (let index = 0; index < 25; index += 1) {
      store.rememberCrawlerAccess(
        `https://example.com/${index}`,
        check(`2026-11-25T00:00:${index}`),
      );
    }
    const stored = store.readStoredCrawlerAccess();
    expect(stored).toHaveLength(20);
    expect(stored[0]![0]).toBe("https://example.com/5");
  });

  it("is cleared with the other stored settings", async () => {
    const store = await freshStore();
    store.rememberCrawlerAccess("https://example.com/a", check("2026-11-25T01:00:00.000Z"));
    const { clearStoredSettings } = await import("../src/adapters/storage");
    await clearStoredSettings();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
