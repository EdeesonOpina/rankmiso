import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPageSpeedInsights } from "../src/services/pagespeed";

afterEach(() => vi.unstubAllGlobals());

describe("PageSpeed Insights request", () => {
  it("sends a user-selected mobile request and returns lab metrics", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          lighthouseResult: {
            categories: { performance: { score: 0.876 } },
            audits: {
              "largest-contentful-paint": { numericValue: 2310.5 },
              "cumulative-layout-shift": { numericValue: 0.1248 },
            },
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestPageSpeedInsights("https://example.com/page", "user-key")).resolves.toEqual(
      { performanceScore: 88, lcpMs: 2311, cls: 0.125 },
    );
    const requestedUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestedUrl.searchParams.get("url")).toBe("https://example.com/page");
    expect(requestedUrl.searchParams.get("strategy")).toBe("mobile");
    expect(requestedUrl.searchParams.get("key")).toBe("user-key");
  });

  it("rejects failed API responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

    await expect(requestPageSpeedInsights("https://example.com", "bad-key")).rejects.toThrow(
      "HTTP 403",
    );
  });
});
