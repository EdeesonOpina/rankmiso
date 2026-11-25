import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  contentUseCrawlerIds,
  crawlerById,
  crawlers,
  platforms,
} from "../src/config/crawlers.config";
import type { AccessCheck } from "../src/services/crawler-access";

const harness = vi.hoisted(() => ({
  granted: true,
  check: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    permissions: { request: vi.fn(() => Promise.resolve(harness.granted)) },
  },
}));

vi.mock("../src/services/crawler-access", async (original) => ({
  ...(await original<typeof import("../src/services/crawler-access")>()),
  checkCrawlerAccess: harness.check,
}));

const { metaDirectives, observePage, robotsStateOf } =
  await import("../src/services/crawler-access");
const { default: AiSearchView } = await import("../src/components/workbench/AiSearchView.vue");

const origin = "https://example.com";
const page = `${origin}/guide`;

function response(status: number, body = "", headers: Record<string, string> = {}) {
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
}

describe("crawler registry", () => {
  it("documents every crawler and links every platform to known crawlers", () => {
    const tokens = crawlers.map((entry) => entry.token.toLowerCase());
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const entry of crawlers) {
      expect(entry.documentationUrl).toMatch(/^https:\/\//);
      expect(entry.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const item of platforms) {
      expect(item.documentationUrl).toMatch(/^https:\/\//);
      for (const id of item.crawlerIds) expect(crawlerById(id)).toBeDefined();
      if (item.supportLevel === "unsupported") expect(item.crawlerIds).toHaveLength(0);
    }
    for (const id of contentUseCrawlerIds) expect(crawlerById(id)).toBeDefined();
  });

  it("keeps control tokens apart from crawlers and invents no Copilot crawler", () => {
    expect(crawlerById("google-extended")?.kind).toBe("content-use");
    expect(crawlerById("usage-ai-training")?.token).toBe("__usage_ai-training");
    expect(crawlers.some((entry) => /copilot/i.test(entry.token))).toBe(false);
    expect(platforms.find((item) => item.id === "copilot")?.crawlerIds).toEqual(["bingbot"]);
    expect(crawlerById("perplexity-user")?.robots).toBe("ignores");
    expect(crawlerById("chatgpt-user")?.robots).toBe("may-ignore");
  });
});

describe("robots.txt fetch outcomes (RFC 9309 §2.3.1)", () => {
  it("never turns a failed browser request into allowed", () => {
    expect(robotsStateOf({ status: 200, unavailable: false })).toBe("read");
    expect(robotsStateOf({ status: 404, unavailable: false })).toBe("missing");
    expect(robotsStateOf({ status: 410, unavailable: true })).toBe("missing");
    expect(robotsStateOf({ status: 429, unavailable: true })).toBe("error");
    expect(robotsStateOf({ status: 503, unavailable: true })).toBe("error");
    expect(robotsStateOf({ status: null, unavailable: true })).toBe("not-read");
    // A 200 that served HTML instead of rules.
    expect(robotsStateOf({ status: 200, unavailable: true })).toBe("not-read");
  });
});

describe("page observation", () => {
  it("reads status, X-Robots-Tag, and initial-HTML meta tags without cookies", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        response(
          200,
          `<html><head><meta name="robots" content="noindex"><meta name="Bingbot" content="ai-grounding:disallow"><meta property="og:title" content="x"></head></html>`,
          { "content-type": "text/html", "x-robots-tag": "gptbot: noindex" },
        ),
      ),
    );
    const observed = await observePage(page, origin, new AbortController().signal, fetcher);
    expect(observed).toEqual({
      state: "read",
      status: 200,
      xRobotsTag: ["gptbot: noindex"],
      meta: [
        { name: "robots", content: "noindex" },
        { name: "Bingbot", content: "ai-grounding:disallow" },
      ],
      reason: "",
    });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "omit", redirect: "manual" });
  });

  it("follows same-origin redirects and stops at another origin", async () => {
    const inside = vi
      .fn()
      .mockResolvedValueOnce(response(301, "", { location: "/guide/" }))
      .mockResolvedValueOnce(response(403, "", { "content-type": "text/plain" }));
    const kept = await observePage(page, origin, new AbortController().signal, inside);
    expect(kept.state).toBe("read");
    expect(kept.status).toBe(403);
    expect(inside.mock.calls[1]?.[0]).toBe(`${origin}/guide/`);

    const away = vi.fn().mockResolvedValue(response(302, "", { location: "https://other.org/" }));
    const left = await observePage(page, origin, new AbortController().signal, away);
    expect(left).toMatchObject({ state: "not-read", reason: "redirect" });
    expect(away).toHaveBeenCalledTimes(1);
  });

  it("reports cancellation and network failure as not read", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    expect((await observePage(page, origin, controller.signal, fetcher)).reason).toBe("aborted");
    expect(fetcher).not.toHaveBeenCalled();
    const failing = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await observePage(page, origin, new AbortController().signal, failing)).reason).toBe(
      "network",
    );
  });

  it("caps meta tags and skips empty ones", () => {
    const html = Array.from({ length: 450 }, (_, i) => `<meta name="m${i}" content="v">`).join("");
    expect(metaDirectives(`<head>${html}<meta name="robots" content=""></head>`)).toHaveLength(400);
  });
});

function fixtureCheck(): AccessCheck {
  // Fixture only: shaped like the Rust engine's output for a sample site.
  const agent = (id: string, crawl: string, extra: object = {}) => ({
    id,
    token: crawlerById(id)!.token,
    crawl,
    group: crawl === "no-rules" ? null : "*",
    rule: null,
    viaWildcard: crawl !== "no-rules",
    indexingState: "read",
    indexing: [],
    ...extra,
  });
  return {
    checkedAt: "2026-11-25T10:00:00.000Z",
    robotsUrl: `${origin}/robots.txt`,
    robotsState: "read",
    robotsStatus: 200,
    page: { state: "read", status: 200, xRobotsTag: [], meta: [], reason: "" },
    report: {
      schemaVersion: 1,
      path: "/guide",
      pageAccess: "ok",
      pageStatus: 200,
      agents: crawlers.map((entry) =>
        entry.id === "gptbot"
          ? agent("gptbot", "disallowed", {
              group: "GPTBot",
              rule: "Disallow: /",
              viaWildcard: false,
            })
          : entry.id === "google-extended"
            ? agent("google-extended", "no-rules")
            : agent(entry.id, "allowed", {
                indexing:
                  entry.id === "googlebot" ? [{ value: "nosnippet", source: "meta robots" }] : [],
              }),
      ) as AccessCheck["report"]["agents"],
      microsoft: {
        state: "read",
        training: null,
        grounding: { value: "disallowextended", source: "meta bingbot" },
        inEffect: false,
      },
    },
  };
}

describe("Discoverability view", () => {
  const audit = { page: { url: page, title: "Guide", language: "en" } } as never;

  beforeEach(() => {
    harness.granted = true;
    harness.check.mockReset();
  });

  it("starts empty and checks nothing until asked", () => {
    const wrapper = mount(AiSearchView, { props: { audit } });
    expect(wrapper.text()).toContain("No check yet");
    expect(wrapper.text()).toContain("not affiliated");
    expect(harness.check).not.toHaveBeenCalled();
  });

  it("does not check when site access is denied", async () => {
    harness.granted = false;
    const wrapper = mount(AiSearchView, { props: { audit } });
    await wrapper.get("button.primary").trigger("click");
    await flushPromises();
    expect(harness.check).not.toHaveBeenCalled();
    expect(wrapper.get("[role=status]").text()).toContain("not granted");
  });

  it("shows each platform's reading, evidence, and content-use preferences", async () => {
    harness.check.mockResolvedValue(fixtureCheck());
    const wrapper = mount(AiSearchView, { props: { audit } });
    await wrapper.get("button.primary").trigger("click");
    await flushPromises();
    expect(harness.check).toHaveBeenCalledWith(page, expect.any(AbortSignal));

    const card = (name: string) =>
      wrapper.findAll(".ax-card").find((c) => c.text().includes(name))!;
    expect(card("Google Search").text()).toContain("Allowed by robots.txt");
    expect(card("Google Search").text()).toContain("nosnippet (meta robots)");
    expect(card("Yahoo Search").text()).toContain("Not supported");
    expect(card("Yahoo Search").find("details").exists()).toBe(false);
    expect(card("Brave Search").text()).toContain("Googlebot");
    expect(card("Microsoft Copilot").text()).toContain("no separate Copilot crawler");
    expect(card("ChatGPT search").findAll(".ax-crawler")).toHaveLength(2);

    const use = wrapper.findAll(".ax-use li");
    const row = (token: string) => use.find((li) => li.text().includes(token))!;
    expect(row("GPTBot").text()).toContain("Disallowed by robots.txt");
    expect(row("GPTBot").text()).toContain("Disallow: /");
    expect(row("Google-Extended").text()).toContain("No preference stated");
    expect(row("Google-Extended").find(".badge").classes()).toContain("gray");
    expect(wrapper.get(".ax-ms").text()).toContain("disallowextended (meta bingbot)");
    expect(wrapper.get(".ax-ms").text()).toContain("1 February 2027");

    const stats = wrapper.findAll(".sx-stat").map((s) => s.text());
    expect(stats[1]).toContain("1");
    expect(card("Gemini apps").text()).toContain("No preference stated");
    expect(card("Gemini apps").text()).not.toContain("Indexing directives");
    // Readings never claim outcomes; only the disclaimer may name them, to deny them.
    const readings = wrapper
      .findAll(".ax-card, .ax-use li, .sx-stat")
      .map((n) => n.text())
      .join(" ");
    expect(readings).not.toMatch(/\b(ranked|indexed|cited|visible in)\b/i);
  });

  it("keeps the latest check for the page when the view is opened again", () => {
    const wrapper = mount(AiSearchView, { props: { audit } });
    expect(wrapper.find(".ax-card").exists()).toBe(true);
    expect(harness.check).not.toHaveBeenCalled();
  });

  it("explains a failed check without inventing results", async () => {
    harness.check.mockRejectedValue(new Error("boom"));
    const other = { page: { url: `${origin}/other`, title: "Other", language: "en" } } as never;
    const wrapper = mount(AiSearchView, { props: { audit: other } });
    await wrapper.get("button.primary").trigger("click");
    await flushPromises();
    expect(wrapper.get("[role=status]").text()).toContain("could not finish");
    expect(wrapper.find(".ax-card").exists()).toBe(false);
  });
});
