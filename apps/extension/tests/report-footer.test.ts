import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import WorkbenchApp from "../src/components/workbench/WorkbenchApp.vue";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      getURL: (path: string) => path,
      getManifest: () => ({ version: "0.6.0" }),
    },
    storage: { local: { get: async () => ({}), set: async () => undefined } },
    tabs: { create: async () => ({}) },
    permissions: { onRemoved: { addListener: () => undefined } },
  },
}));

vi.mock("../src/composables/useAudit", async () => {
  const { ref } = await import("vue");
  return {
    useAudit: () => ({
      status: ref("ready"),
      error: ref(""),
      audit: ref(null),
      tab: ref(null),
      stale: ref(false),
      probing: ref(false),
      probeMessage: ref(""),
      siteAccessState: ref(null),
      siteAccessHost: ref(""),
      siteAccessPending: ref(false),
      inspectionMode: ref("individual"),
      automaticAccessGranted: ref(false),
      refresh,
      requestSiteAccess: vi.fn(),
      enableAutomaticChecks: vi.fn(),
      setInspectionMode: vi.fn(),
      revokeAutomaticAccess: vi.fn(),
      dismissSiteAccess: vi.fn(),
      runSiteProbe: vi.fn(),
      checkFreshness: vi.fn(),
    }),
  };
});

describe("full-page report footer", () => {
  it("keeps the local-analysis note and refresh, without Open sidebar", async () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const report = mount(WorkbenchApp, { props: { surface: "report" } });
    const footer = report.get("footer");
    expect(footer.text()).toContain("Local analysis · No account · No telemetry");
    expect(footer.text()).not.toContain("Open sidebar");
    expect(footer.findAll("button")).toHaveLength(1);
    refresh.mockClear();
    await footer.get("button").trigger("click");
    expect(footer.get("button").text()).toContain("Refresh analysis");
    expect(refresh).toHaveBeenCalledOnce();
    report.unmount();
  });

  it("keeps the sidebar control that opens the full report", () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const sidebar = mount(WorkbenchApp, { props: { surface: "sidebar" } });
    const footer = sidebar.get("footer");
    expect(footer.text()).toContain("Open full report");
    expect(footer.text()).not.toContain("Open sidebar");
    sidebar.unmount();
  });
});
