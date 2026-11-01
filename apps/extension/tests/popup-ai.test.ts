import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PopupApp from "../entrypoints/popup/App.vue";

vi.mock("wxt/browser", () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));
vi.mock("../src/services/sidebar", () => ({ sidebarAvailable: () => false }));
vi.mock("../src/services/inspect", () => ({
  clearHighlights: vi.fn(),
  highlightElements: vi.fn(),
}));
vi.mock("../src/composables/useAudit", async () => {
  const { ref } = await import("vue");
  return {
    useAudit: () => ({
      status: ref("error"),
      error: ref("No page audit is available"),
      audit: ref(null),
      tab: ref(null),
      stale: ref(false),
      refresh: vi.fn(),
      inspectionMode: ref(null),
      automaticAccessGranted: ref(false),
      enableAutomaticChecks: vi.fn(),
      setInspectionMode: vi.fn(),
      revokeAutomaticAccess: vi.fn(),
    }),
  };
});
vi.mock("../src/composables/useTheme", async () => {
  const { ref } = await import("vue");
  return { useTheme: () => ({ preference: ref("light"), setPreference: vi.fn() }) };
});
vi.mock("../src/components/workbench/AIIntegrationsView.vue", () => ({
  default: {
    template:
      "<section data-testid='popup-ai-screen'>Local MCP Companion · Shared audits</section>",
  },
}));

describe("AI popup destination", () => {
  it("renders AI Integrations in the popup without a page audit", async () => {
    const scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const wrapper = mount(PopupApp);
    await flushPromises();

    await wrapper.get('button[data-nav="ai-integrations"]').trigger("click");
    await flushPromises();

    expect(wrapper.get(".page-title").text()).toBe("AI Integrations");
    expect(wrapper.get('[data-testid="popup-ai-screen"]').text()).toContain("Shared audits");
    expect(wrapper.text()).not.toContain("No page audit is available");
    expect(wrapper.get('button[data-nav="ai-integrations"]').attributes("aria-current")).toBe(
      "page",
    );
    wrapper.unmount();
    if (scrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollTo);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    if (scrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", scrollIntoView);
    else delete (Element.prototype as Partial<Element>).scrollIntoView;
  });
});
