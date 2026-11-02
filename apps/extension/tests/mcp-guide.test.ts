import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../entrypoints/mcp-guide/App.vue";

vi.mock("wxt/browser", () => ({
  browser: { runtime: { getURL: (path: string) => `chrome-extension://rankmiso${path}` } },
}));

describe("bundled MCP guide", () => {
  it("opens without a companion and covers plugin setup, sharing, privacy, limitations, and manual setup", () => {
    const wrapper = mount(App);

    const text = wrapper.text();
    expect(text).toContain("companion v0.5.1 or later");
    expect(text).toContain("/plugin marketplace add EdeesonOpina/rankmiso");
    expect(text).toContain("/plugin install rankmiso@rankmiso");
    expect(text).toContain("codex plugin marketplace add EdeesonOpina/rankmiso");
    expect(text).toContain("codex plugin add rankmiso@rankmiso");
    expect(text).toContain("Connect RankMiso");
    expect(text).toContain("Restart your AI client");
    expect(text).toContain("Enable local sharing");
    expect(text).toContain("Share with MCP");
    expect(text).toContain("does not guarantee local AI processing");
    expect(text).toContain("Firefox, including Snap Firefox: sharing is not verified yet");
    expect(text).toContain("rankmiso-setup configure codex");
    expect(wrapper.get(".mcp-guide-site-link").attributes("href")).toBe(
      "https://github.com/EdeesonOpina/rankmiso/blob/master/docs/integrations/README.md",
    );
    expect(wrapper.get(".mcp-guide-site-link").text()).toContain("Full setup guide on GitHub");
    expect(wrapper.get(".mcp-guide-site-link").attributes("target")).toBe("_blank");
    expect(wrapper.get(".mcp-guide-back").attributes("href")).toBe(
      "chrome-extension://rankmiso/dashboard.html?section=ai-integrations",
    );
  });
});
