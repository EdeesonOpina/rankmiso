import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RedirectObserver } from "../src/services/redirect-observer";

const harness = vi.hoisted(() => ({
  granted: true,
  details: false,
  traces: [] as unknown[],
}));
vi.mock("wxt/browser", () => ({
  browser: {
    permissions: {
      request: vi.fn((query: { permissions?: string[] }) =>
        Promise.resolve(query.permissions ? harness.details : harness.granted),
      ),
      contains: vi.fn(() => Promise.resolve(false)),
    },
  },
}));
vi.mock("../src/wasm/pkg/seo_wasm.js", () => ({
  analyze_redirects: (json: string) => {
    harness.traces.push(JSON.parse(json));
    return JSON.stringify({ schemaVersion: 1, findings: [] });
  },
}));
vi.mock("../src/services/engine", () => ({ ensureEngine: () => Promise.resolve() }));

const { traceRedirects } = await import("../src/services/redirect-trace");
const { fetchCrawlPage } = await import("../src/services/site-crawl-network");
const { default: RedirectTraceCard } =
  await import("../src/components/workbench/RedirectTraceCard.vue");
const { workbenchKey } = await import("../src/components/workbench/context");
const provide = { [workbenchKey as symbol]: { surface: "report" } };
enableAutoUnmount(afterEach);

const origin = "https://example.com";
type Route = { status: number; location?: string; body?: string };

/** A fake site: redirects come back opaque, as in a browser; the observer sees the real headers. */
function site(routes: Record<string, Route>) {
  const seen: Record<string, Route> = {};
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes[url];
    if (!route) throw new TypeError("Failed to fetch");
    seen[url] = route;
    if (route.status >= 300 && route.status < 400) {
      return {
        type: "opaqueredirect",
        status: 0,
        headers: new Headers(),
        body: null,
      } as unknown as Response;
    }
    return new Response(route.body ?? "", {
      status: route.status,
      headers: { "content-type": "text/html" },
    });
  });
  const observer: RedirectObserver = {
    read: async (url) =>
      seen[url] ? { status: seen[url].status, location: seen[url].location ?? null } : null,
    stop: () => undefined,
  };
  return { fetcher: fetcher as unknown as typeof fetch, observer, calls: fetcher };
}

const signal = () => new AbortController().signal;

describe("redirect trace", () => {
  it("follows each hop and reads the final page", async () => {
    const { fetcher, observer } = site({
      [`${origin}/a`]: { status: 301, location: "/b" },
      [`${origin}/b`]: { status: 302, location: `${origin}/c` },
      [`${origin}/c`]: {
        status: 200,
        body: `<meta http-equiv="refresh" content="0; url=/d"><link rel="canonical" href="/a">`,
      },
    });
    const trace = await traceRedirects(`${origin}/a`, origin, signal(), observer, fetcher);
    expect(trace.hops).toEqual([
      { url: `${origin}/a`, status: 301, location: `${origin}/b` },
      { url: `${origin}/b`, status: 302, location: `${origin}/c` },
    ]);
    expect(trace).toMatchObject({
      finalUrl: `${origin}/c`,
      finalStatus: 200,
      redirected: true,
      stopped: "",
      hopsObserved: true,
      metaRefresh: { delay: 0, url: `${origin}/d` },
      canonical: `${origin}/a`,
    });
  });

  it("stops on loops, at the site boundary, at non-web schemes, and at missing pages", async () => {
    const loop = site({
      [`${origin}/a`]: { status: 301, location: "/b" },
      [`${origin}/b`]: { status: 301, location: "/a" },
    });
    expect(
      (await traceRedirects(`${origin}/a`, origin, signal(), loop.observer, loop.fetcher)).stopped,
    ).toBe("loop");
    const away = site({ [`${origin}/a`]: { status: 308, location: "https://other.org/" } });
    const left = await traceRedirects(`${origin}/a`, origin, signal(), away.observer, away.fetcher);
    expect(left.stopped).toBe("left-origin");
    expect(away.calls).toHaveBeenCalledTimes(1);
    const scheme = site({ [`${origin}/a`]: { status: 302, location: "javascript:alert(1)" } });
    expect(
      (await traceRedirects(`${origin}/a`, origin, signal(), scheme.observer, scheme.fetcher))
        .stopped,
    ).toBe("blocked");
    const missing = site({
      [`${origin}/a`]: { status: 301, location: "/gone" },
      [`${origin}/gone`]: { status: 404 },
    });
    const gone = await traceRedirects(
      `${origin}/a`,
      origin,
      signal(),
      missing.observer,
      missing.fetcher,
    );
    expect(gone).toMatchObject({ finalStatus: 404, finalUrl: `${origin}/gone` });
  });

  it("records an HTTPS downgrade hop without following it off the origin", async () => {
    const down = site({ [`${origin}/a`]: { status: 301, location: "http://example.com/a" } });
    const trace = await traceRedirects(
      `${origin}/a`,
      origin,
      signal(),
      down.observer,
      down.fetcher,
    );
    expect(trace.hops[0]!.location).toBe("http://example.com/a");
    expect(trace.stopped).toBe("left-origin");
  });

  it("without redirect details, says a redirect happened and follows nothing", async () => {
    const { fetcher, calls } = site({
      [`${origin}/a`]: { status: 301, location: "/b" },
      [`${origin}/b`]: { status: 200 },
    });
    const trace = await traceRedirects(`${origin}/a`, origin, signal(), null, fetcher);
    expect(trace).toMatchObject({ redirected: true, stopped: "unreadable", hopsObserved: false });
    expect(trace.hops).toEqual([]);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("reports cancellation and network failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetcher } = site({});
    expect(
      (await traceRedirects(`${origin}/a`, origin, controller.signal, null, fetcher)).stopped,
    ).toBe("aborted");
    expect((await traceRedirects(`${origin}/a`, origin, signal(), null, fetcher)).stopped).toBe(
      "network",
    );
  });

  it("lets Site Explorer follow same-origin redirects when details are allowed", async () => {
    const { fetcher, observer } = site({
      [`${origin}/old`]: { status: 301, location: "/new" },
      [`${origin}/new`]: { status: 200, body: "<html><title>New</title></html>" },
    });
    const followed = await fetchCrawlPage(`${origin}/old`, origin, signal(), fetcher, observer);
    expect(followed).toMatchObject({
      status: 200,
      finalUrl: `${origin}/new`,
      hops: [`${origin}/new`],
    });
    const blind = await fetchCrawlPage(`${origin}/old`, origin, signal(), fetcher, null);
    expect(blind.status).toBeNull();
    expect(blind.error).toContain("Allow redirect details");
  });
});

describe("redirect trace card", () => {
  const audit = { page: { url: `${origin}/a`, title: "A", language: "en" } } as never;
  beforeEach(() => {
    harness.granted = true;
    harness.details = false;
    harness.traces.length = 0;
  });

  it("checks the URL and site access before tracing", async () => {
    const wrapper = mount(RedirectTraceCard, { props: { audit }, global: { provide } });
    await wrapper.get("input").setValue("https://other.org/");
    await wrapper.findAll("button")[0]!.trigger("click");
    await flushPromises();
    expect(wrapper.get("[role=status]").text()).toContain("site you are inspecting");

    harness.granted = false;
    await wrapper.get("input").setValue(`${origin}/a`);
    await wrapper.findAll("button")[0]!.trigger("click");
    await flushPromises();
    expect(wrapper.get("[role=status]").text()).toContain("not granted");
    expect(harness.traces).toHaveLength(0);
  });

  it("explains the optional permission and reports a refusal", async () => {
    const wrapper = mount(RedirectTraceCard, { props: { audit }, global: { provide } });
    await flushPromises();
    expect(wrapper.text()).toContain("optional webRequest permission");
    const allow = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Allow redirect details"))!;
    await allow.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("were not allowed");
  });
});
