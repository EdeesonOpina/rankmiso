import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  browser: {
    sidePanel: undefined as
      { close?: (options: { tabId?: number; windowId?: number }) => Promise<void> } | undefined,
    sidebarAction: undefined as { close?: () => Promise<void> } | undefined,
    tabs: { create: vi.fn(async () => ({ id: 2 })) },
    runtime: { getURL: vi.fn((path: string) => `moz-extension://rankmiso${path}`) },
  },
}));

vi.mock("wxt/browser", () => ({ browser: state.browser }));

import { closeSidebar, openReportFromSidebar } from "../src/services/sidebar";

describe("sidebar report transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.browser.sidePanel = undefined;
    state.browser.sidebarAction = undefined;
    state.browser.tabs.create.mockResolvedValue({ id: 2 });
  });

  it("closes the global Chrome side panel in the originating window", async () => {
    const close = vi.fn(async () => undefined);
    state.browser.sidePanel = { close };

    const closed = await openReportFromSidebar(41, 7, "site");

    expect(closed).toBe(true);
    expect(state.browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://rankmiso/dashboard.html?tabId=41&section=site",
    });
    expect(close).toHaveBeenCalledWith({ windowId: 7 });
    expect(state.browser.tabs.create.mock.invocationCallOrder[0]).toBeLessThan(
      close.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("uses Firefox sidebarAction.close", async () => {
    const close = vi.fn(async () => undefined);
    state.browser.sidebarAction = { close };

    await expect(closeSidebar(41, 7)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the report open when the browser cannot close the sidebar", async () => {
    state.browser.sidePanel = {
      close: vi.fn(async () => {
        throw new Error("Unsupported API");
      }),
    };

    await expect(openReportFromSidebar(41, 7, "site")).resolves.toBe(false);
    expect(state.browser.tabs.create).toHaveBeenCalledOnce();
  });

  it("reports an unsupported close operation to the caller", async () => {
    await expect(closeSidebar(41, 7)).rejects.toThrow("does not support closing");
  });
});
