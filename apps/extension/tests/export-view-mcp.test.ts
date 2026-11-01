import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExportView from "../src/components/workbench/ExportView.vue";
import { workbenchKey, type WorkbenchContext } from "../src/components/workbench/context";
import type { AuditResult } from "../src/types/audit";

const harness = vi.hoisted(() => {
  const listeners: { message: Array<(message: unknown) => void>; disconnect: Array<() => void> } = {
    message: [],
    disconnect: [],
  };
  const permissionListeners: {
    added: Array<(permissions: { permissions?: string[] }) => void>;
    removed: Array<(permissions: { permissions?: string[] }) => void>;
  } = { added: [], removed: [] };
  const browser = {
    permissions: {
      contains: vi.fn(async () => true),
      request: vi.fn(async () => true),
      onAdded: {
        addListener: (callback: (permissions: { permissions?: string[] }) => void) =>
          permissionListeners.added.push(callback),
        removeListener: (callback: (permissions: { permissions?: string[] }) => void) => {
          permissionListeners.added = permissionListeners.added.filter((item) => item !== callback);
        },
      },
      onRemoved: {
        addListener: (callback: (permissions: { permissions?: string[] }) => void) =>
          permissionListeners.removed.push(callback),
        removeListener: (callback: (permissions: { permissions?: string[] }) => void) => {
          permissionListeners.removed = permissionListeners.removed.filter(
            (item) => item !== callback,
          );
        },
      },
    },
    tabs: { get: vi.fn(async () => ({ id: 9, url: "https://example.test/path" })) },
    storage: { local: { set: vi.fn(async () => undefined) } },
    runtime: {
      lastError: undefined as { message?: string } | undefined,
      connectNative: vi.fn(() => ({
        onMessage: {
          addListener: (callback: (message: unknown) => void) => listeners.message.push(callback),
          removeListener: (callback: (message: unknown) => void) => {
            listeners.message = listeners.message.filter((item) => item !== callback);
          },
        },
        onDisconnect: {
          addListener: (callback: () => void) => listeners.disconnect.push(callback),
          removeListener: (callback: () => void) => {
            listeners.disconnect = listeners.disconnect.filter((item) => item !== callback);
          },
        },
        postMessage: vi.fn((request: { requestId: string }) => {
          queueMicrotask(() =>
            listeners.message.forEach((callback) =>
              callback({
                protocolVersion: 1,
                requestId: request.requestId,
                ok: true,
                result: {
                  snapshot: {
                    snapshotId: "rankmiso-shared-123-0",
                    pageUrl: "https://example.test/path",
                    pageTitle: "Test title",
                    analyzedAt: "2026-10-31T12:00:00Z",
                    sharedAtUnixMs: 1,
                    auditType: "audit",
                  },
                },
              }),
            ),
          );
        }),
        disconnect: vi.fn(),
      })),
    },
  };
  return { browser, listeners, permissionListeners };
});

vi.mock("wxt/browser", () => ({ browser: harness.browser }));

const testAudit = {
  schemaVersion: 1,
  analyzedAt: "2026-10-31T12:00:00Z",
  page: { url: "https://example.test/path", title: "Test title", language: "en" },
} as AuditResult;
const toastMessage = vi.fn();

function mountView() {
  const context = {
    tabId: ref(9),
    toast: toastMessage,
    go: vi.fn(),
  } as unknown as WorkbenchContext;
  return mount(ExportView, {
    props: { audit: testAudit },
    global: { provide: { [workbenchKey as symbol]: context } },
  });
}

describe("full report MCP sharing action", () => {
  beforeEach(() => {
    harness.browser.permissions.contains.mockReset().mockResolvedValue(true);
    harness.browser.permissions.request.mockReset().mockResolvedValue(true);
    harness.browser.tabs.get
      .mockReset()
      .mockResolvedValue({ id: 9, url: "https://example.test/path" });
    harness.browser.runtime.connectNative.mockClear();
    toastMessage.mockClear();
    harness.listeners.message = [];
    harness.listeners.disconnect = [];
    harness.permissionListeners.added = [];
    harness.permissionListeners.removed = [];
    vi.stubGlobal("crypto", { randomUUID: () => "share-request" });
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.open = false;
      };
    }
  });

  it("requires explicit confirmation and completes a local share", async () => {
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.browser.permissions.request.mockImplementation(async () => {
      harness.browser.permissions.contains.mockResolvedValue(true);
      return true;
    });
    const wrapper = mountView();
    await wrapper.get(".mcp-share-action button").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("dialog").exists()).toBe(true));
    expect(wrapper.get("dialog").text()).toContain("https://example.test/path");
    expect(wrapper.text()).toContain("Your AI assistant may send shared findings");
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
    await wrapper.get("dialog .primary").trigger("click");
    await vi.waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith(
        "Audit Shared Successfully",
        "Your SEO audit was saved locally.",
        "success",
      ),
    );
    expect(harness.browser.permissions.request).toHaveBeenCalledWith({
      permissions: ["nativeMessaging"],
    });
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledOnce();
    expect(harness.browser.storage.local.set).toHaveBeenCalledWith({
      "rankmiso.mcpIntegrationEnabled": true,
    });
    expect(wrapper.find(".share-success-link").text()).toContain("View Shared Audits");
    wrapper.unmount();
  });

  it("cancels without permission or native process access", async () => {
    const wrapper = mountView();
    await wrapper.get(".mcp-share-action button").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("dialog").exists()).toBe(true));
    await wrapper.get("dialog .secondary").trigger("click");
    await nextTick();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not share when the user denies Native Messaging permission", async () => {
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.browser.permissions.request.mockResolvedValue(false);
    const wrapper = mountView();
    await wrapper.get(".mcp-share-action button").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("dialog").exists()).toBe(true));
    await wrapper.get("dialog .primary").trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("required local connection or audit-data permission"),
    );
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("returns from a pending permission prompt and does not request or share twice", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (granted: boolean) => void;
    const request = new Promise<boolean>((resolve) => (resolveRequest = resolve));
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.browser.permissions.request.mockReturnValue(request);
    const wrapper = mountView();

    try {
      await wrapper.get(".mcp-share-action button").trigger("click");
      await vi.waitFor(() => expect(wrapper.find("dialog").exists()).toBe(true));
      await wrapper.get("dialog .primary").trigger("click");
      await vi.advanceTimersByTimeAsync(10_000);
      await nextTick();
      expect(wrapper.text()).toContain("The browser permission decision is still pending.");

      await wrapper.get("dialog .primary").trigger("click");
      await nextTick();
      expect(harness.browser.permissions.request).toHaveBeenCalledTimes(1);
      expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
    } finally {
      resolveRequest(false);
      await request;
      await Promise.resolve();
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it("refuses to open confirmation after the inspected tab has changed", async () => {
    harness.browser.tabs.get.mockResolvedValue({ id: 9, url: "https://example.test/other" });
    const wrapper = mountView();
    await wrapper.get(".mcp-share-action button").trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("has changed since this audit"));
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps raw browser errors out of share feedback", async () => {
    harness.browser.tabs.get.mockRejectedValueOnce(new Error("internal browser failure"));
    const wrapper = mountView();
    await wrapper.get(".mcp-share-action button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("The inspected page is no longer available.");
    expect(wrapper.text()).not.toContain("internal browser failure");
    expect(wrapper.find("dialog").exists()).toBe(false);
    wrapper.unmount();
  });
});
