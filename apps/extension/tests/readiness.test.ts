import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageSnapshot } from "../src/types/audit";
import type { ReadinessFinding, ReadinessReport } from "../src/services/readiness";

const harness = vi.hoisted(() => ({ requests: [] as unknown[], response: "" }));

vi.mock("../src/wasm/pkg/seo_wasm.js", () => ({
  analyze_readiness: (json: string) => {
    harness.requests.push(JSON.parse(json));
    return harness.response;
  },
}));
vi.mock("../src/services/engine", () => ({ ensureEngine: () => Promise.resolve() }));

const { analyzeReadiness, summarize } = await import("../src/services/readiness");
const store = await import("../src/services/ai-search-store");
const { default: ContentReadinessPanel } =
  await import("../src/components/workbench/ContentReadinessPanel.vue");
const { workbenchKey } = await import("../src/components/workbench/context");

enableAutoUnmount(afterEach);

const url = "https://example.com/guide";
const snapshot = { schemaVersion: 1, url } as unknown as PageSnapshot;

// Fixture only: shaped like the Rust engine's output.
function finding(patch: Partial<ReadinessFinding>): ReadinessFinding {
  return {
    id: "READY_X",
    group: "structure",
    reused: false,
    category: "content",
    status: "PASS",
    weight: 0,
    applicable: true,
    titleKey: "rules.readyX.title",
    title: "A check",
    description: "What was observed.",
    evidence: [],
    recommendation: null,
    references: [],
    ...patch,
  } as ReadinessFinding;
}

const fixture: ReadinessReport = {
  schemaVersion: 1,
  pageType: "article",
  findings: [
    finding({
      id: "READY_CRAWLER_ACCESS",
      group: "discoverability",
      status: "UNAVAILABLE",
      title: "Search and AI search crawler rules",
    }),
    finding({
      id: "READY_RENDERING",
      group: "discoverability",
      status: "UNAVAILABLE",
      title: "Content before and after JavaScript",
    }),
    finding({
      id: "RULE_H1_MISSING",
      group: "structure",
      reused: true,
      status: "PASS",
      category: "headings",
      title: "H1 is present",
    }),
    finding({
      id: "READY_SD_HEADLINE",
      group: "structuredData",
      status: "WARNING",
      title: "Structured data headline matches the page",
      recommendation: "Make the markup describe what the page shows.",
      evidence: [{ label: "JSON-LD", value: "Completely different" }],
      references: [
        { title: "Google: structured data guidelines", url: "https://developers.google.com/x" },
      ],
    }),
    finding({
      id: "READY_TEXT_LENGTH",
      group: "clarity",
      status: "INFO",
      title: "Visible text",
    }),
    finding({
      id: "READY_AUTHOR",
      group: "attribution",
      status: "NOT_APPLICABLE",
      title: "Author",
    }),
  ],
};

describe("readiness service", () => {
  beforeEach(() => {
    harness.requests.length = 0;
    harness.response = JSON.stringify(fixture);
  });

  it("sends the snapshot and only summaries of earlier checks", async () => {
    await analyzeReadiness(snapshot);
    expect(harness.requests[0]).toEqual({ schemaVersion: 1, snapshot });

    await analyzeReadiness(
      snapshot,
      {
        checkedAt: "2026-11-25T10:00:00.000Z",
        robotsUrl: `${url}/robots.txt`,
        robotsState: "read",
        robotsStatus: 200,
        page: { state: "read", status: 200, xRobotsTag: [], meta: [], reason: "" },
        report: {
          schemaVersion: 1,
          path: "/guide",
          pageAccess: "ok",
          pageStatus: 200,
          agents: [
            {
              id: "googlebot",
              token: "Googlebot",
              crawl: "allowed",
              group: "*",
              rule: null,
              viaWildcard: true,
              indexingState: "read",
              indexing: [],
            },
          ],
          microsoft: { state: "read", training: null, grounding: null, inEffect: false },
        },
      },
      {
        checkedAt: "2026-11-25T10:00:00.000Z",
        report: {
          schemaVersion: 1,
          sourceOrigin: "fetch",
          findings: [finding({ id: "RENDER_TITLE", status: "WARNING" })],
        },
      },
    );
    expect(harness.requests[1]).toEqual({
      schemaVersion: 1,
      snapshot,
      crawler: {
        checkedAt: "2026-11-25T10:00:00.000Z",
        robotsState: "read",
        pageAccess: "ok",
        agents: [{ id: "googlebot", crawl: "allowed" }],
      },
      rendering: { sourceOrigin: "fetch", findings: [{ id: "RENDER_TITLE", status: "WARNING" }] },
    });
  });

  it("counts results without making a score", () => {
    expect(summarize(fixture.findings)).toEqual({
      completed: 3,
      opportunities: 1,
      clear: 1,
      notMeasured: 2,
      notApplicable: 1,
    });
  });

  it("keeps at most 20 pages of earlier results in memory", () => {
    const report = { schemaVersion: 1, sourceOrigin: "file" as const, findings: [] };
    for (let i = 0; i < 25; i += 1) store.rememberRendering(`${url}?p=${i}`, report, "t");
    expect(store.renderingFor(`${url}?p=0`)).toBeUndefined();
    expect(store.renderingFor(`${url}?p=24`)).toBeDefined();
  });
});

describe("content readiness panel", () => {
  const audit = {
    page: { url, title: "Brewing miso at home", language: "en" },
    analyzedAt: "2026-11-25T09:00:00.000Z",
  } as never;
  const go = vi.fn();

  function mountPanel(page: PageSnapshot | null = snapshot) {
    return mount(ContentReadinessPanel, {
      props: { audit },
      global: { provide: { [workbenchKey as symbol]: { snapshot: ref(page), go } } },
    });
  }

  beforeEach(() => {
    harness.requests.length = 0;
    harness.response = JSON.stringify(fixture);
    go.mockReset();
  });

  it("shows groups, counts, evidence, and the page type", async () => {
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.text()).toContain("Page type: article");
    const stats = wrapper.findAll(".sx-stat").map((s) => s.text());
    expect(stats[0]).toContain("3");
    expect(stats[1]).toContain("1");
    expect(stats[2]).toContain("2");
    expect(stats[3]).toContain("1");
    const sections = wrapper.findAll(".ax-section").map((s) => s.find("h3").text());
    expect(sections).toEqual([
      "Technical discoverability",
      "Content structure",
      "Content clarity",
      "Entity and attribution",
      "Structured data consistency",
      "Content accessibility",
    ]);
    const warning = wrapper.findAll(".ax-finding").find((f) => f.text().includes("headline"))!;
    expect(warning.find(".badge").text()).toBe("Review");
    expect(warning.text()).toContain("What to check:");
    expect(warning.find("details").text()).toContain("Completely different");
    expect(warning.find("details a").attributes("rel")).toBe("noopener noreferrer");
    const length = wrapper.findAll(".ax-finding").find((f) => f.text().includes("Visible text"))!;
    expect(length.find(".badge").text()).toBe("Observation");
    expect(wrapper.text()).toContain("not a score");
    expect(wrapper.text()).toContain("llms.txt is not checked");
  });

  it("offers the existing checks instead of running them", async () => {
    const wrapper = mountPanel();
    await flushPromises();
    expect(harness.requests).toHaveLength(1);
    await wrapper.get("button.secondary").trigger("click");
    expect(wrapper.emitted("openAccess")).toHaveLength(1);
    const buttons = wrapper.findAll("button.secondary");
    await buttons[1]!.trigger("click");
    expect(go).toHaveBeenCalledWith("technical");
    const reused = wrapper.findAll("button.icon-text").find((b) => b.text().includes("Issues"))!;
    await reused.trigger("click");
    expect(go).toHaveBeenCalledWith("issues", { check: "RULE_H1_MISSING" });
  });

  it("reruns when an earlier check result for this page arrives", async () => {
    mountPanel();
    await flushPromises();
    store.rememberRendering(
      url,
      { schemaVersion: 1, sourceOrigin: "fetch", findings: [] },
      "2026-11-25T08:00:00.000Z",
    );
    await flushPromises();
    expect(harness.requests).toHaveLength(2);
    expect((harness.requests[1] as { rendering: unknown }).rendering).toBeDefined();
  });

  it("says when an earlier check is older than the page analysis", async () => {
    store.rememberRendering(
      url,
      { schemaVersion: 1, sourceOrigin: "fetch", findings: [] },
      "2026-11-25T08:00:00.000Z",
    );
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.text()).toContain("HTML comparison ran before the latest page analysis");
  });

  it("has an empty state without a snapshot and an error state when the engine fails", async () => {
    const empty = mountPanel(null);
    await flushPromises();
    expect(empty.text()).toContain("No page data yet");
    expect(harness.requests).toHaveLength(0);

    harness.response = "not json";
    const failed = mountPanel();
    await flushPromises();
    expect(failed.text()).toContain("could not run");
    expect(failed.find(".ax-finding").exists()).toBe(false);
  });
});
