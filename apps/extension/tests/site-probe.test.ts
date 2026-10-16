import { describe, expect, it } from "vitest";
import {
  alternatePointsBack,
  collectHeaders,
  isBlockedProbeHost,
  pageListedInSitemap,
  sitemapUrlsFromRobots,
} from "../src/services/site-probe";

describe("site probe guards", () => {
  it("skips local and private hosts", () => {
    expect(isBlockedProbeHost("localhost")).toBe(true);
    expect(isBlockedProbeHost("127.0.0.1")).toBe(true);
    expect(isBlockedProbeHost("10.1.2.3")).toBe(true);
    expect(isBlockedProbeHost("192.168.1.9")).toBe(true);
    expect(isBlockedProbeHost("172.16.0.4")).toBe(true);
    expect(isBlockedProbeHost("169.254.1.1")).toBe(true);
    expect(isBlockedProbeHost("::1")).toBe(true);
    expect(isBlockedProbeHost("example.com")).toBe(false);
    expect(isBlockedProbeHost("1.1.1.1")).toBe(false);
  });

  it("reads sitemap lines and drops private targets", () => {
    const body = [
      "# comment",
      "User-agent: *",
      "Sitemap: https://example.com/sitemap.xml",
      "Sitemap: http://127.0.0.1/secret.xml",
      "Sitemap: /relative.xml",
    ].join("\n");
    expect(sitemapUrlsFromRobots(body, "https://example.com/robots.txt")).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/relative.xml",
    ]);
  });

  it("sees the open URL in a sitemap loc", () => {
    const xml = "<urlset><url><loc>https://example.com/guide/</loc></url></urlset>";
    expect(pageListedInSitemap(xml, "https://example.com/guide")).toBe(true);
    expect(pageListedInSitemap(xml, "https://example.com/other")).toBe(false);
  });

  it("reads a return hreflang link", () => {
    const html = '<link rel="alternate" hreflang="en" href="https://example.com/guide">';
    expect(alternatePointsBack(html, "https://example.com/guide")).toBe(true);
    expect(alternatePointsBack(html, "https://example.com/fr")).toBe(false);
  });

  it("keeps an allowlist of response headers", () => {
    const headers = new Headers({
      "Content-Type": "text/html",
      "Set-Cookie": "session=secret",
      "X-Robots-Tag": "noindex",
    });
    expect(collectHeaders(headers)).toEqual([
      { name: "content-type", value: "text/html" },
      { name: "x-robots-tag", value: "noindex" },
    ]);
  });
});
