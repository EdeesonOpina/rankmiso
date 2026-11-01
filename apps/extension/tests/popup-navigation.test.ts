import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PopupRail from "../src/components/PopupRail.vue";
import { flatNav } from "../src/config/navigation.config";
import { navigatePopupDestination } from "../src/config/popup-navigation";

describe("AI navigation", () => {
  it("shows a clickable AI item with the existing icon and full accessible label", async () => {
    const item = flatNav.find(({ id }) => id === "ai-integrations")!;
    const select = vi.fn();
    const wrapper = mount(PopupRail, {
      props: {
        items: [
          {
            id: item.id,
            label: "AI",
            short: "AI",
            accessibleLabel: "AI Integrations",
          },
        ],
        current: "ai-integrations",
        label: "Tools",
        menuLabel: "All tools",
        menuOpen: false,
      },
      attrs: { onSelect: select },
    });

    const button = wrapper.get('button[data-nav="ai-integrations"]');
    expect(button.attributes("title")).toBe("AI Integrations");
    expect(button.attributes("aria-label")).toBe("AI Integrations");
    expect(button.attributes("aria-current")).toBe("page");
    expect(button.attributes("tabindex")).toBe("0");
    expect(button.find("svg").exists()).toBe(true);
    await button.trigger("click");
    expect(select).toHaveBeenCalledWith("ai-integrations");
  });

  it("opens AI Integrations in the popup when its screen is available", () => {
    const navigateInPopup = vi.fn();
    const openInReport = vi.fn();

    navigatePopupDestination("ai-integrations", true, navigateInPopup, openInReport);

    expect(navigateInPopup).toHaveBeenCalledWith("ai-integrations");
    expect(openInReport).not.toHaveBeenCalled();
  });

  it("opens a destination in the report only when no popup screen exists", () => {
    const navigateInPopup = vi.fn();
    const openInReport = vi.fn();

    navigatePopupDestination("ai-integrations", false, navigateInPopup, openInReport);

    expect(openInReport).toHaveBeenCalledWith("ai-integrations");
    expect(navigateInPopup).not.toHaveBeenCalled();
  });
});
