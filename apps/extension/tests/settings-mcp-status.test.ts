import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import AIIntegrationsView from "../src/components/workbench/AIIntegrationsView.vue";
import { workbenchKey } from "../src/components/workbench/context";

const harness = vi.hoisted(() => {
  class NativeCompanionError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  const bridge = {
    MCP_STATUS_FRESH_MS: 15_000,
    checkNativeCompanion: vi.fn(async () => true),
    hasMcpAccessPermission: vi.fn(async () => true),
    hasNativeMessagingPermission: vi.fn(async () => true),
    isNativeMessagingPermissionRequestPending: vi.fn(() => false),
    listSharedAudits: vi.fn(async () => ({
      snapshots: [],
      total: 0,
      offset: 0,
      nextOffset: null,
    })),
    removeSharedAudit: vi.fn(),
    requestNativeMessagingPermission: vi.fn(),
    NativeCompanionError,
  };
  const toast = vi.fn();
  const mcpStorage = { enabled: false };
  const permissionRemovedListeners = new Set<(permissions: { permissions?: string[] }) => void>();
  const activatedListeners = new Set<(activeInfo: { tabId: number; windowId: number }) => void>();
  const browser = {
    permissions: {
      contains: vi.fn(async () => true),
      onAdded: {
        addListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) =>
          permissionAddedListeners.add(listener),
        ),
        removeListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) =>
          permissionAddedListeners.delete(listener),
        ),
      },
      onRemoved: {
        addListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) =>
          permissionRemovedListeners.add(listener),
        ),
        removeListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) =>
          permissionRemovedListeners.delete(listener),
        ),
      },
    },
    tabs: {
      onActivated: {
        addListener: vi.fn((listener: (activeInfo: { tabId: number; windowId: number }) => void) =>
          activatedListeners.add(listener),
        ),
        removeListener: vi.fn(
          (listener: (activeInfo: { tabId: number; windowId: number }) => void) =>
            activatedListeners.delete(listener),
        ),
      },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({ "rankmiso.mcpIntegrationEnabled": mcpStorage.enabled })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          if (typeof values["rankmiso.mcpIntegrationEnabled"] === "boolean") {
            mcpStorage.enabled = values["rankmiso.mcpIntegrationEnabled"] as boolean;
          }
        }),
        remove: vi.fn(async () => undefined),
      },
    },
    runtime: {
      getManifest: () => ({ version: "0.4.0" }),
      getURL: (path: string) => `chrome-extension://rankmiso/${path.replace(/^\//, "")}`,
    },
  };
  const permissionAddedListeners = new Set<(permissions: { permissions?: string[] }) => void>();
  return {
    browser,
    bridge,
    permissionAddedListeners,
    permissionRemovedListeners,
    activatedListeners,
    mcpStorage,
    toast,
  };
});

vi.mock("wxt/browser", () => ({ browser: harness.browser }));
vi.mock("../src/services/mcp-native-bridge", () => harness.bridge);

function workbench() {
  return {
    [workbenchKey as symbol]: {
      preference: ref("system"),
      setPreference: vi.fn(),
      inspectionMode: ref("individual"),
      toast: harness.toast,
      automaticAccessGranted: ref(false),
      setInspectionMode: vi.fn(),
      enableAutomaticChecks: vi.fn(),
      revokeAutomaticAccess: vi.fn(),
    },
  };
}

describe("MCP connection status", () => {
  beforeEach(() => {
    harness.browser.permissions.contains.mockReset().mockResolvedValue(true);
    harness.bridge.hasNativeMessagingPermission.mockReset().mockResolvedValue(true);
    harness.bridge.hasMcpAccessPermission
      .mockReset()
      .mockImplementation(async () => harness.bridge.hasNativeMessagingPermission());
    harness.bridge.checkNativeCompanion.mockReset().mockResolvedValue(true);
    harness.bridge.requestNativeMessagingPermission.mockReset().mockResolvedValue(true);
    harness.bridge.removeSharedAudit.mockReset();
    harness.bridge.listSharedAudits.mockReset().mockResolvedValue({
      snapshots: [],
      total: 0,
      offset: 0,
      nextOffset: null,
    });
    harness.permissionAddedListeners.clear();
    harness.permissionRemovedListeners.clear();
    harness.activatedListeners.clear();
    harness.mcpStorage.enabled = false;
    harness.toast.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps the local MCP guide available before the companion is connected", async () => {
    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(false);
    harness.bridge.hasMcpAccessPermission.mockResolvedValue(false);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    const guide = wrapper.get('a[href="chrome-extension://rankmiso/mcp-guide.html"]');
    expect(guide.text()).toContain("View Guide");
    expect(guide.attributes("target")).toBe("_blank");
    expect(wrapper.find(".mcp-status").text()).toContain("Permission Required");
    wrapper.unmount();
  });

  it("shows permission required when the optional permission is absent", async () => {
    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(false);
    harness.bridge.hasMcpAccessPermission.mockResolvedValue(false);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    expect(wrapper.find(".mcp-status").text()).toContain("Permission Required");
    expect(
      wrapper.findAll("button").some((button) => button.text() === "Enable local sharing"),
    ).toBe(true);
    expect(wrapper.find(".mcp-status").text()).toContain("Grant Native Messaging");
    expect(wrapper.find(".mcp-status").text()).toContain("Firefox also asks");
    wrapper.unmount();
  });

  it("shows an actionable Companion Not Found result for missing host registration", async () => {
    harness.bridge.checkNativeCompanion.mockRejectedValueOnce(
      new harness.bridge.NativeCompanionError("not-installed"),
    );
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();

    const status = wrapper.find(".mcp-status");
    expect(status.text()).toContain("Companion Not Found");
    expect(status.text()).toContain("README-INSTALL.md");
    wrapper.unmount();
  });

  it("shows connected after a successful ping", async () => {
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();

    expect(wrapper.find(".mcp-status").text()).toContain("Connected");
    expect(wrapper.find(".mcp-status").text()).toContain("Your local RankMiso companion is ready.");
    expect(harness.mcpStorage.enabled).toBe(true);
    wrapper.unmount();
  });

  it("distinguishes a registered host that fails to start or respond", async () => {
    const failure = new harness.bridge.NativeCompanionError("connection-failed");
    failure.message = "Local companion unavailable: native messaging host terminated";
    harness.bridge.checkNativeCompanion.mockRejectedValueOnce(failure);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();

    expect(wrapper.find(".mcp-status").text()).toContain("Connection Failed");
    expect(wrapper.find(".mcp-status").text()).toContain(
      "registered host could not start or respond",
    );
    expect(wrapper.find(".mcp-status").text()).not.toContain("native messaging host terminated");
    wrapper.unmount();
  });

  it("checks the companion when a delayed permission grant arrives", async () => {
    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(false);
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.bridge.isNativeMessagingPermissionRequestPending.mockReturnValue(true);
    harness.bridge.requestNativeMessagingPermission.mockResolvedValue(null);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();
    expect(wrapper.find(".mcp-status").text()).toContain("Awaiting Permission");
    expect(harness.bridge.checkNativeCompanion).not.toHaveBeenCalled();

    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(true);
    harness.browser.permissions.contains.mockResolvedValue(true);
    for (const listener of harness.permissionAddedListeners) {
      listener({ permissions: ["nativeMessaging"] });
    }
    await flushPromises();

    expect(harness.bridge.checkNativeCompanion).toHaveBeenCalledOnce();
    expect(wrapper.find(".mcp-status").text()).toContain("Connected");
    expect(harness.toast).toHaveBeenCalledWith(
      "Companion Connected",
      "RankMiso can now share approved audits with your local companion.",
      "success",
    );
    wrapper.unmount();
  });

  it("automatically checks an enabled companion when AI Integrations opens", async () => {
    harness.mcpStorage.enabled = true;
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    expect(harness.bridge.checkNativeCompanion).toHaveBeenCalledOnce();
    expect(harness.bridge.listSharedAudits).toHaveBeenCalledOnce();
    expect(harness.bridge.requestNativeMessagingPermission).not.toHaveBeenCalled();
    expect(wrapper.find(".mcp-status").text()).toContain("Connected");
    wrapper.unmount();
  });

  it("restores and revalidates the saved connection after the integration view remounts", async () => {
    harness.mcpStorage.enabled = true;
    const first = mount(AIIntegrationsView, { global: { provide: workbench() } });
    await flushPromises();
    expect(first.find(".mcp-status").text()).toContain("Connected");
    first.unmount();

    const returned = mount(AIIntegrationsView, { global: { provide: workbench() } });
    await flushPromises();

    expect(harness.bridge.checkNativeCompanion).toHaveBeenCalledTimes(2);
    expect(harness.bridge.requestNativeMessagingPermission).not.toHaveBeenCalled();
    expect(returned.find(".mcp-status").text()).toContain("Connected");
    returned.unmount();
  });

  it("does not check the companion when local sharing is disabled", async () => {
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    expect(harness.bridge.checkNativeCompanion).not.toHaveBeenCalled();
    expect(harness.bridge.listSharedAudits).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("expires the Connected label without starting a polling loop", async () => {
    vi.useFakeTimers();
    harness.mcpStorage.enabled = true;
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    try {
      await flushPromises();
      expect(wrapper.find(".mcp-status").text()).toContain("Connected");

      await vi.advanceTimersByTimeAsync(15_000);
      await flushPromises();

      expect(wrapper.find(".mcp-status").text()).toContain("Ready to check");
      expect(wrapper.find(".mcp-status").text()).toContain("last companion check expired");
      expect(harness.bridge.checkNativeCompanion).toHaveBeenCalledOnce();
      expect(wrapper.find(".mcp-shared-list").exists()).toBe(false);
    } finally {
      wrapper.unmount();
      expect(harness.activatedListeners.size).toBe(0);
      vi.useRealTimers();
    }
  });

  it("revalidates an expired connection once after a website tab switch", async () => {
    vi.useFakeTimers();
    harness.mcpStorage.enabled = true;
    const wrapper = mount(AIIntegrationsView, { global: { provide: workbench() } });
    try {
      await flushPromises();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(wrapper.find(".mcp-status").text()).toContain("Ready to check");

      for (const listener of harness.activatedListeners) {
        listener({ tabId: 42, windowId: 1 });
        listener({ tabId: 43, windowId: 1 });
      }
      await flushPromises();

      expect(harness.bridge.checkNativeCompanion).toHaveBeenCalledTimes(2);
      expect(wrapper.find(".mcp-status").text()).toContain("Connected");
      expect(harness.bridge.requestNativeMessagingPermission).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      expect(harness.activatedListeners.size).toBe(0);
      vi.useRealTimers();
    }
  });

  it("invalidates status on permission revocation and reconnects after permission returns", async () => {
    harness.mcpStorage.enabled = true;
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();
    expect(wrapper.find(".mcp-status").text()).toContain("Connected");

    harness.permissionRemovedListeners.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );
    await flushPromises();
    expect(wrapper.find(".mcp-status").text()).toContain("Permission Required");
    expect(
      wrapper.findAll("button").some((button) => button.text() === "Enable local sharing"),
    ).toBe(true);
    expect(wrapper.find(".mcp-shared-list").exists()).toBe(false);
    expect(harness.mcpStorage.enabled).toBe(true);

    harness.permissionAddedListeners.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );
    await flushPromises();
    expect(wrapper.find(".mcp-status").text()).toContain("Connected");
    wrapper.unmount();
  });

  it("does not persist or ping when the user denies permission", async () => {
    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(false);
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.bridge.requestNativeMessagingPermission.mockResolvedValue(false);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();

    expect(harness.mcpStorage.enabled).toBe(false);
    expect(harness.bridge.checkNativeCompanion).not.toHaveBeenCalled();
    expect(wrapper.find(".mcp-status").text()).toContain("Permission Required");
    wrapper.unmount();
  });

  it("does not restore the enabled preference after disable while permission is pending", async () => {
    harness.mcpStorage.enabled = true;
    harness.bridge.hasNativeMessagingPermission.mockResolvedValue(false);
    harness.browser.permissions.contains.mockResolvedValue(false);
    harness.bridge.requestNativeMessagingPermission.mockResolvedValue(null);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    await flushPromises();
    expect(wrapper.find(".mcp-status").text()).toContain("Awaiting Permission");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Disable local sharing")
      ?.trigger("click");
    await flushPromises();
    harness.permissionAddedListeners.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );
    await flushPromises();

    expect(harness.mcpStorage.enabled).toBe(false);
    expect(harness.bridge.checkNativeCompanion).not.toHaveBeenCalled();
    expect(wrapper.find(".mcp-status").text()).toContain("Local MCP sharing is disabled");
    wrapper.unmount();
  });

  it("removes only the selected snapshot and confirms after the host acknowledges deletion", async () => {
    const remaining = {
      snapshotId: "rankmiso-shared-100-0",
      pageUrl: "https://misoecosystem.com/",
      pageTitle: "Miso Ecosystem",
      analyzedAt: "2026-10-31T12:40:00Z",
      sharedAtUnixMs: 100,
      auditType: "audit" as const,
    };
    const selected = { ...remaining, snapshotId: "rankmiso-shared-200-0", sharedAtUnixMs: 200 };
    harness.mcpStorage.enabled = true;
    harness.bridge.listSharedAudits.mockResolvedValue({
      snapshots: [selected, remaining],
      total: 2,
      offset: 0,
      nextOffset: null,
    } as never);
    harness.bridge.removeSharedAudit.mockResolvedValue({ removed: true });
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    const rows = wrapper.findAll(".mcp-shared-item");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text()).toContain("Snapshot · ed-200-0");
    expect(rows[0]?.text()).toContain("Analyzed");
    expect(rows[0]?.text()).toContain("Shared");
    await rows[0]?.find("button").trigger("click");
    await wrapper.findAll(".mcp-shared-item")[0]?.findAll("button")[0]?.trigger("click");
    await flushPromises();

    expect(harness.bridge.removeSharedAudit).toHaveBeenCalledWith("rankmiso-shared-200-0");
    expect(harness.toast).toHaveBeenCalledWith(
      "Audit Removed",
      "The snapshot was removed from local MCP storage.",
      "success",
    );
    expect(harness.bridge.listSharedAudits).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
