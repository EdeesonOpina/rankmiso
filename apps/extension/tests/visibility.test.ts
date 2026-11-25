import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ inputs: [] as Array<Record<string, unknown>> }));
vi.mock("../src/wasm/pkg/seo_wasm.js", () => ({
  // Stand-in for the Rust classifier (tested in seo-rules): link on the domain = cited.
  classify_visibility: (json: string) => {
    const input = JSON.parse(json) as {
      domain: string;
      response: string;
      citations: string[];
      outcome: string;
    };
    harness.inputs.push(input);
    if (input.domain.includes(" ")) throw new Error("INVALID_DOMAIN");
    const links = [...input.citations];
    const cited = links.find((link) => link.includes(input.domain));
    const pasted = input.response.trim() !== "" || links.length > 0;
    return JSON.stringify({
      domain: input.domain,
      status: cited ? "cited" : pasted ? "not-observed" : input.outcome || "not-measured",
      basis: pasted ? "pasted" : "manual",
      citations: links.map((url, index) => ({
        url,
        order: index + 1,
        onDomain: url.includes(input.domain),
      })),
      mentions: [],
      notes: [],
    });
  },
}));
vi.mock("../src/services/engine", () => ({ ensureEngine: () => Promise.resolve() }));

const visibility = await import("../src/services/visibility");
const { default: VisibilityPanel } =
  await import("../src/components/workbench/VisibilityPanel.vue");
enableAutoUnmount(afterEach);

const { VISIBILITY_KEY, VISIBILITY_LIMITS, emptyStore, loadStore, saveStore, visibilityCsv } =
  visibility;

function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    read: () => value,
  };
}

function observation(index: number, patch: Record<string, unknown> = {}) {
  return {
    id: `o${index}`,
    queryId: "q1",
    platformId: "perplexity",
    observedOn: "2026-11-20",
    recordedAt: `2026-11-20T00:00:${String(index % 60).padStart(2, "0")}.${String(index).padStart(3, "0")}Z`,
    basis: "manual" as const,
    status: "unknown" as const,
    citations: [],
    mentions: [],
    excerpt: "",
    notes: "",
    ...patch,
  };
}

describe("visibility store", () => {
  const query = {
    id: "q1",
    text: "best miso",
    domain: "example.com",
    brand: "",
    createdAt: "2026-11-20",
  };

  it("drops damaged or unknown records instead of trusting them", () => {
    expect(loadStore(memory("{not json")).damaged).toBe(true);
    expect(loadStore(memory(JSON.stringify({ schemaVersion: 2, queries: [] }))).damaged).toBe(true);
    const raw = {
      schemaVersion: 1,
      queries: [query, { id: "", text: "x" }],
      observations: [
        observation(1),
        observation(2, { platformId: "unknown-ai" }),
        observation(3, { status: "ranked-1" }),
        observation(4, { queryId: "missing" }),
      ],
    };
    const { store, damaged } = loadStore(memory(JSON.stringify(raw)));
    expect(damaged).toBe(true);
    expect(store.queries).toHaveLength(1);
    expect(store.observations.map((item) => item.id)).toEqual(["o1"]);
  });

  it("keeps at most 20 samples per question and service, dropping the oldest", () => {
    const store = emptyStore();
    store.queries.push(query);
    for (let i = 0; i < 25; i += 1) store.observations.push(observation(i));
    const storage = memory();
    expect(saveStore(store, storage)).toBe(5);
    expect(store.observations).toHaveLength(VISIBILITY_LIMITS.perQueryPlatform);
    expect(store.observations.some((item) => item.id === "o0")).toBe(false);
    expect(JSON.parse(storage.read()!).observations).toHaveLength(20);
  });

  it("reports a refused save", () => {
    const store = emptyStore();
    expect(
      saveStore(store, {
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    ).toBeNull();
  });

  it("neutralizes spreadsheet formulas in CSV exports", () => {
    const store = emptyStore();
    store.queries.push({ ...query, text: '=HYPERLINK("http://x")' });
    store.observations.push(observation(1, { notes: "+cmd" }));
    const csv = visibilityCsv(store);
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
  });
});

describe("visibility panel", () => {
  const audit = { page: { url: "https://www.example.com/a", title: "A", language: "en" } } as never;
  beforeEach(() => {
    localStorage.clear();
    harness.inputs.length = 0;
  });

  async function addQuestion(wrapper: ReturnType<typeof mount>) {
    await wrapper.findAll("input")[0]!.setValue("best miso shop");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
  }

  it("starts empty, prefills the domain, and adds a question that persists", async () => {
    const wrapper = mount(VisibilityPanel, { props: { audit } });
    expect(wrapper.text()).toContain("No questions tracked yet");
    expect((wrapper.findAll("input")[1]!.element as HTMLInputElement).value).toBe("example.com");
    await addQuestion(wrapper);
    expect(wrapper.text()).toContain("best miso shop");
    expect(JSON.parse(localStorage.getItem(VISIBILITY_KEY)!).queries[0].domain).toBe("example.com");
    expect(harness.inputs).toHaveLength(0);
  });

  it("records a pasted answer as cited and a later manual sample as a change", async () => {
    const wrapper = mount(VisibilityPanel, { props: { audit } });
    await addQuestion(wrapper);
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Record an answer")!
      .trigger("click");
    const form = wrapper.find(".vis-record");
    await form.find("select").setValue("perplexity");
    await form.findAll("input")[0]!.setValue("2026-11-20");
    await form.findAll("textarea")[1]!.setValue("https://other.org/a\nhttps://example.com/miso");
    await form.trigger("submit");
    await flushPromises();
    const row = wrapper.find(".vis-rows .ax-finding");
    expect(row.text()).toContain("Perplexity");
    expect(row.find(".badge").text()).toBe("Cited");
    expect(row.text()).toContain("Link 2 in the pasted list: https://example.com/miso");

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Record an answer")!
      .trigger("click");
    const next = wrapper.find(".vis-record");
    await next.find("select").setValue("perplexity");
    await next.findAll("input")[0]!.setValue("2026-11-24");
    await next.findAll("select")[1]!.setValue("not-observed");
    await next.trigger("submit");
    await flushPromises();
    const updated = wrapper.find(".vis-rows .ax-finding");
    expect(updated.find(".badge").text()).toBe("Not observed in this sample");
    expect(updated.text()).toContain("Previously Cited on 2026-11-20");
    expect(updated.text()).toContain("recorded by hand");
    expect(wrapper.text()).not.toMatch(/\brank(ed|ing)? #?\d/i);
  });

  it("deletes a sample and a question with its samples", async () => {
    const wrapper = mount(VisibilityPanel, { props: { audit } });
    await addQuestion(wrapper);
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Record an answer")!
      .trigger("click");
    await wrapper.find(".vis-record").trigger("submit");
    await flushPromises();
    const sampleDelete = wrapper.find('.vis-history button[aria-label^="Delete the sample"]');
    await sampleDelete.trigger("click");
    expect(wrapper.text()).toContain("No samples recorded yet.");
    await wrapper.find('button[aria-label^="Delete question"]').trigger("click");
    expect(wrapper.text()).toContain("No questions tracked yet");
    expect(JSON.parse(localStorage.getItem(VISIBILITY_KEY)!).observations).toEqual([]);
  });

  it("reports an unreadable domain without saving", async () => {
    const wrapper = mount(VisibilityPanel, { props: { audit } });
    await wrapper.findAll("input")[0]!.setValue("q");
    await wrapper.findAll("input")[1]!.setValue("not a domain");
    await wrapper.find("form").trigger("submit");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Record an answer")!
      .trigger("click");
    await wrapper.find(".vis-record").trigger("submit");
    await flushPromises();
    expect(wrapper.get("[role=status]").text()).toContain("could not be read");
    expect(JSON.parse(localStorage.getItem(VISIBILITY_KEY)!).observations).toEqual([]);
  });
});
