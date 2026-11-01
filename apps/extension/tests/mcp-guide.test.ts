import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../entrypoints/mcp-guide/App.vue";

vi.mock("wxt/browser", () => ({
  browser: { runtime: { getURL: (path: string) => `chrome-extension://rankmiso${path}` } },
}));

describe("bundled MCP guide", () => {
  it("opens without a companion and covers install, sharing, clients, privacy, and limitations", () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain("Public companion downloads are not available yet");
    expect(wrapper.text()).toContain("Enable local sharing");
    expect(wrapper.text()).toContain("rankmiso-setup configure codex");
    expect(wrapper.text()).toContain("claude mcp get rankmiso");
    expect(wrapper.text()).toContain("does not guarantee local AI processing");
    expect(wrapper.text()).toContain("Firefox live connection remain unverified");
    expect(wrapper.get(".mcp-guide-back").attributes("href")).toBe(
      "chrome-extension://rankmiso/dashboard.html?section=ai-integrations",
    );
  });
});
