import { describe, expect, it, vi } from "vitest";
import { fetchComparisonHtml } from "../src/services/html-fetch";

const signal = new AbortController().signal;

describe("HTML fetch", () => {
  it("does not follow a redirect off the host", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("", { status: 302, headers: { location: "https://other.example/next" } });
    });
    const result = await fetchComparisonHtml("https://example.com/page", signal, fetcher);
    expect(result).toEqual({ ok: false, reason: "redirect" });
  });

  it("rejects a non-HTML response and an oversized body", async () => {
    const text = vi.fn(async () => {
      return new Response("not html", { status: 200, headers: { "content-type": "text/plain" } });
    });
    expect(await fetchComparisonHtml("https://example.com/page", signal, text)).toEqual({
      ok: false,
      reason: "type",
    });
    const large = vi.fn(async () => {
      return new Response("x".repeat(20), {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "900000" },
      });
    });
    expect(await fetchComparisonHtml("https://example.com/page", signal, large)).toEqual({
      ok: false,
      reason: "size",
    });
  });

  it("does not follow a redirect onto a private host", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("", { status: 302, headers: { location: "http://10.1.2.3/secret" } });
    });
    const result = await fetchComparisonHtml("https://example.com/page", signal, fetcher);
    expect(result).toEqual({ ok: false, reason: "blocked" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns HTML after one same-host redirect and omits credentials", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("omit");
      const url = String(input);
      if (url.endsWith("/page")) {
        return new Response("", { status: 302, headers: { location: "/done" } });
      }
      return new Response("<!doctype html><title>Done</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    const result = await fetchComparisonHtml("https://example.com/page", signal, fetcher);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hops).toEqual(["302 https://example.com/done"]);
      expect(result.html).toContain("Done");
    }
  });
});
