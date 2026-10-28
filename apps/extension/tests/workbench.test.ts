import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CheckTable from "../src/components/CheckTable.vue";
import IssueCard from "../src/components/IssueCard.vue";
import ScoreBlock from "../src/components/ScoreBlock.vue";
import { workbenchGroupId } from "../src/config/navigation.config";
import { findingGuide, findingGuides } from "../src/locales/findings.en";
import { selectChecks } from "../src/services/check-list";
import { nextTabId, scrollThumb } from "../src/services/tablist";
import type { CheckResult, ScoreSummary } from "../src/types/audit";

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

describe("workbench navigation", () => {
  it("keeps existing report sections reachable", () => {
    expect(workbenchGroupId("headings")).toBe("onpage");
    expect(workbenchGroupId("schema")).toBe("onpage");
    expect(workbenchGroupId("performance")).toBe("technical");
    expect(workbenchGroupId("reports")).toBe("history");
    expect(workbenchGroupId("export")).toBe("export");
    expect(workbenchGroupId("sitemaps")).toBe("sitemaps");
    expect(workbenchGroupId("settings")).toBe("settings");
    expect(workbenchGroupId("not-a-section")).toBe("overview");
  });
});

describe("tablist keys", () => {
  const ids = ["overview", "issues", "inspect"];

  it("moves and wraps", () => {
    expect(nextTabId("overview", ids, "ArrowRight")).toBe("issues");
    expect(nextTabId("overview", ids, "ArrowLeft")).toBe("inspect");
    expect(nextTabId("issues", ids, "Home")).toBe("overview");
    expect(nextTabId("issues", ids, "End")).toBe("inspect");
    expect(nextTabId("issues", ids, "Enter")).toBeNull();
    expect(scrollThumb(0, 100, 100)).toBeNull();
    expect(scrollThumb(0, 100, 400)).toEqual({ size: 25, start: 0 });
    expect(scrollThumb(300, 100, 400)?.start).toBe(75);
  });
});

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

describe("issue presentation", () => {
  it("shows the page suggestion separately from a generic example", () => {
    const wrapper = mount(IssueCard, {
      props: {
        check: check({
          id: "RULE_META_TITLE_MISSING",
          status: "ERROR",
          title: "Title missing",
          recommendation: "Add one title element.",
        }),
      },
    });
    expect(wrapper.text()).toContain("Add one title element.");
    expect(wrapper.text()).toContain("Example only");
    expect(wrapper.text()).toContain("<title>");
    expect(wrapper.find("code").text()).not.toContain("Add one title element.");
  });

  it("hides the example on a compact card", () => {
    const wrapper = mount(IssueCard, {
      props: {
        check: check({ id: "RULE_H1_MISSING", status: "ERROR", title: "H1 missing" }),
        compact: true,
      },
    });
    expect(wrapper.text()).toContain("H1 missing");
    expect(wrapper.find("code").exists()).toBe(false);
  });

  it("draws a measured category and leaves an empty category unlabeled as a score", () => {
    const score: ScoreSummary = {
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
    const wrapper = mount(ScoreBlock, { props: { score } });
    expect(wrapper.text()).toContain("50");
    expect(wrapper.find(".score-ring-value").attributes("stroke-dashoffset")).toBe("50");
    expect(wrapper.text()).toContain("Not measured");
    expect(wrapper.text()).toContain("Not a ranking.");
    const fills = wrapper.findAll(".category-fill");
    expect(fills[0]?.attributes("style")).toContain("50%");
    expect(fills[1]?.attributes("style")).toContain("0%");
  });

  it("searches and sorts the issue list", async () => {
    const wrapper = mount(CheckTable, {
      props: {
        title: "Issues",
        showCategory: true,
        checks: [
          check({ id: "b", status: "PASS", title: "Passed title", category: "content" }),
          check({ id: "a", status: "ERROR", title: "Missing title", category: "metadata" }),
        ],
      },
    });
    const cards = () => wrapper.findAll("article h3").map((item) => item.text());
    expect(cards()).toEqual(["Missing title", "Passed title"]);
    await wrapper.find("input[type='search']").setValue("passed");
    expect(cards()).toEqual(["Passed title"]);
  });
});
