export interface PageSpeedResult {
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
}

export async function requestPageSpeedInsights(
  pageUrl: string,
  apiKey: string,
): Promise<PageSpeedResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.append("category", "performance");
  const response = await fetch(endpoint, {
    credentials: "omit",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`PageSpeed Insights returned HTTP ${response.status}.`);
  const payload = (await response.json()) as {
    lighthouseResult?: {
      categories?: { performance?: { score?: number | null } };
      audits?: {
        "largest-contentful-paint"?: { numericValue?: number };
        "cumulative-layout-shift"?: { numericValue?: number };
      };
    };
  };
  const lighthouse = payload.lighthouseResult;
  if (!lighthouse) throw new Error("PageSpeed Insights returned no Lighthouse result.");
  const score = lighthouse.categories?.performance?.score;
  const lcp = lighthouse.audits?.["largest-contentful-paint"]?.numericValue;
  const cls = lighthouse.audits?.["cumulative-layout-shift"]?.numericValue;
  return {
    performanceScore: typeof score === "number" ? Math.round(score * 100) : null,
    lcpMs: typeof lcp === "number" ? Math.round(lcp) : null,
    cls: typeof cls === "number" ? Math.round(cls * 1000) / 1000 : null,
  };
}
