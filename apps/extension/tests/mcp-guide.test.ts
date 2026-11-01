import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../entrypoints/mcp-guide/App.vue";

vi.mock("wxt/browser", () => ({
  browser: { runtime: { getURL: (path: string) => `chrome-extension://rankmiso${path}` } },
}));

describe("bundled MCP guide", () => {
  it("opens without a companion and covers install, sharing, clients, privacy, and limitations", () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain("MCP is part of RankMiso v0.5.0");
    expect(wrapper.text()).toContain("when its release packages are published and verified");
    expect(wrapper.text()).toContain("Enable local sharing");
    expect(wrapper.text()).toContain("rankmiso-setup configure codex");
    expect(wrapper.text()).toContain("claude mcp get rankmiso");
    expect(wrapper.text()).toContain("does not guarantee local AI processing");
    expect(wrapper.text()).toContain("Firefox live connection remain unverified");
    expect(wrapper.get(".mcp-guide-site-link").attributes("href")).toBe(
      "https://misoecosystem.com/products/rankmiso/#mcp",
    );
    expect(wrapper.get(".mcp-guide-site-link").text()).toContain(
      "View official companion downloads and setup",
    );
    expect(wrapper.get(".mcp-guide-site-link").attributes("target")).toBe("_blank");
    expect(wrapper.get(".mcp-guide-back").attributes("href")).toBe(
      "chrome-extension://rankmiso/dashboard.html?section=ai-integrations",
    );
  });
});
