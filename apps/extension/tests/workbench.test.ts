import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import IssuesView from "../src/components/workbench/IssuesView.vue";
import OverviewView from "../src/components/workbench/OverviewView.vue";
import RelatedChecks from "../src/components/workbench/RelatedChecks.vue";
import { workbenchKey, type Surface } from "../src/components/workbench/context";
import { findingGuide, findingGuides } from "../src/locales/findings.en";
import { selectChecks } from "../src/services/check-list";
import type { AuditResult, CheckResult, ScoreSummary } from "../src/types/audit";

function check(patch: Partial<CheckResult> & Pick<CheckResult, "id" | "status">): CheckResult {
  return {
    category: "metadata",
    weight: 1,
    applicable: true,
    titleKey: "rules.metaTitleMissing.title",
    title: patch.title ?? patch.id,
    description: patch.description ?? "Description",
    evidence: [],
    recommendation: null,
    references: [],
    ...patch,
  };
}

describe("check list", () => {
  const checks = [
    check({ id: "pass", status: "PASS", title: "Zebra" }),
    check({ id: "warn", status: "WARNING", title: "Middle", recommendation: "Shorten it" }),
    check({ id: "err", status: "ERROR", title: "Alpha", category: "images" }),
  ];

  it("sorts errors ahead of passes without mutating the source", () => {
    const sorted = selectChecks(checks);
    expect(sorted.map((item) => item.id)).toEqual(["err", "warn", "pass"]);
    expect(checks.map((item) => item.id)).toEqual(["pass", "warn", "err"]);
  });

  it("filters by query, status, and category", () => {
    expect(selectChecks(checks, { query: "shorten" }).map((item) => item.id)).toEqual(["warn"]);
    expect(selectChecks(checks, { status: "ERROR", category: "images" })).toHaveLength(1);
    expect(selectChecks(checks, { sort: "title" }).map((item) => item.title)).toEqual([
      "Alpha",
      "Middle",
      "Zebra",
    ]);
  });
});

describe("finding guides", () => {
  it("adds verification for a known rule and stays silent for unknown ids", () => {
    expect(findingGuide("RULE_META_TITLE_MISSING")?.verify).toMatch(/title/i);
    expect(findingGuide("RULE_NOT_REAL")).toBeNull();
  });

  it("does not promise rankings", () => {
    const text = Object.values(findingGuides)
      .flatMap((guide) => [guide.verify, guide.example ?? ""])
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/will rank|domain rating|search volume|keyword difficulty/);
  });
});

function context(surface: Surface = "report") {
  return {
    [workbenchKey as symbol]: {
      surface,
      tabId: ref(undefined),
      ready: ref(true),
      probing: ref(false),
      probeMessage: ref(""),
      preference: ref("light"),
      issueFocus: ref(null),
      go: vi.fn(),
      toast: vi.fn(),
      copy: vi.fn(),
      highlight: vi.fn(),
      clearMarks: vi.fn(),
      refresh: vi.fn(),
      runSiteProbe: vi.fn(),
      setPreference: vi.fn(),
      openReport: vi.fn(),
    },
  };
}

const baseScore: ScoreSummary = {
  available: true,
  value: 50,
  disclaimer: "Not a ranking.",
  applicableChecks: 1,
  excludedChecks: 1,
  errors: 1,
  warnings: 0,
  passed: 0,
  info: 0,
  unavailable: 1,
  notApplicable: 0,
  categories: [
    {
      category: "metadata",
      available: true,
      value: 50,
      applicableChecks: 1,
      errors: 1,
      warnings: 0,
      passed: 0,
    },
    {
      category: "performance",
      available: false,
      value: null,
      applicableChecks: 0,
      errors: 0,
      warnings: 0,
      passed: 0,
    },
  ],
};

function audit(checks: CheckResult[], score: ScoreSummary = baseScore): AuditResult {
  return {
    page: { url: "https://example.com/", title: "Example", language: "en" },
    score,
    checks,
    source: { limitations: [] },
    details: {
      metadata: { title: "Example", canonicals: [], robots: [], language: "en" },
    },
  } as unknown as AuditResult;
}

describe("issue presentation", () => {
  it("shows the page suggestion separately from a generic example", () => {
    const wrapper = mount(IssuesView, {
      props: {
        audit: audit([
          check({
            id: "RULE_META_TITLE_MISSING",
            status: "ERROR",
            title: "Title missing",
            recommendation: "Add one title element.",
          }),
        ]),
      },
      global: { provide: context() },
    });
    expect(wrapper.text()).toContain("Add one title element.");
    expect(wrapper.text()).toContain("Example only");
    expect(wrapper.text()).toContain("<title>");
    expect(wrapper.find("code").text()).not.toContain("Add one title element.");
  });

  it("lists only errors and warnings in the sidebar checks", () => {
    const checks = [
      check({ id: "a", status: "PASS", title: "Fine title" }),
      check({ id: "b", status: "WARNING", title: "Long title" }),
    ];
    const sidebar = mount(RelatedChecks, {
      props: { audit: audit(checks), category: "metadata" },
      global: { provide: context("sidebar") },
    });
    expect(sidebar.text()).toContain("Long title");
    expect(sidebar.text()).not.toContain("Fine title");
    expect(sidebar.text()).toContain("2 in Issues");
    const report = mount(RelatedChecks, {
      props: { audit: audit(checks), category: "metadata" },
      global: { provide: context("report") },
    });
    expect(report.text()).toContain("Fine title");
  });

  it("draws a measured category and leaves an empty category unlabeled as a score", () => {
    const wrapper = mount(OverviewView, {
      props: { audit: audit([]) },
      global: { provide: context("report") },
    });
    expect(wrapper.find(".score-figure").text()).toContain("50");
    const ring = wrapper.findAll(".score-svg circle")[1];
    expect(Number(ring?.attributes("stroke-dashoffset"))).toBeCloseTo(Math.PI * 42, 1);
    expect(wrapper.text()).toContain("Not measured");
    expect(wrapper.text()).toContain("Not a ranking.");
    const items = wrapper.findAll(".category-item");
    expect(items[0]?.find(".fill").attributes("style")).toContain("50%");
    expect(items[1]?.find(".fill").exists()).toBe(false);
  });

  it("shows a dash, not zero, when there is no score", () => {
    const wrapper = mount(OverviewView, {
      props: { audit: audit([], { ...baseScore, available: false, value: null }) },
      global: { provide: context("sidebar") },
    });
    expect(wrapper.find(".score-figure").text()).toContain("–");
    expect(wrapper.findAll(".score-svg circle")).toHaveLength(1);
  });

  it("searches and sorts the issue list", async () => {
    const wrapper = mount(IssuesView, {
      props: {
        audit: audit([
          check({ id: "b", status: "PASS", title: "Passed title", category: "content" }),
          check({ id: "a", status: "ERROR", title: "Missing title", category: "metadata" }),
        ]),
      },
      global: { provide: context() },
    });
    const cards = () => wrapper.findAll("article h3").map((item) => item.text());
    expect(cards()).toEqual(["Missing title", "Passed title"]);
    await wrapper.find("input[type='search']").setValue("passed");
    expect(cards()).toEqual(["Passed title"]);
  });
});
