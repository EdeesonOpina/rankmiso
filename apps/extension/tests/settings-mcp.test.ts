import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import SettingsView from "../src/components/workbench/SettingsView.vue";
import AIIntegrationsView from "../src/components/workbench/AIIntegrationsView.vue";
import { workbenchKey } from "../src/components/workbench/context";

const harness = vi.hoisted(() => {
  const addedListeners: Array<(permissions: { permissions?: string[] }) => void> = [];
  const messageListeners: Array<(message: unknown) => void> = [];
  const permissions = {
    contains: vi.fn(async () => false),
    request: vi.fn(),
    onAdded: {
      addListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) =>
        addedListeners.push(listener),
      ),
      removeListener: vi.fn((listener: (permissions: { permissions?: string[] }) => void) => {
        const index = addedListeners.indexOf(listener);
        if (index >= 0) addedListeners.splice(index, 1);
      }),
    },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  };
  const browser = {
    permissions,
    storage: {
      local: {
        get: vi.fn(async () => ({ "rankmiso.mcpIntegrationEnabled": false })),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
    },
    runtime: {
      getManifest: () => ({ version: "0.4.0" }),
      connectNative: vi.fn(() => ({
        onMessage: {
          addListener: (listener: (message: unknown) => void) => messageListeners.push(listener),
          removeListener: (listener: (message: unknown) => void) => {
            const index = messageListeners.indexOf(listener);
            if (index >= 0) messageListeners.splice(index, 1);
          },
        },
        onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
        postMessage: vi.fn((message: { requestId: string; type?: string }) => {
          queueMicrotask(() =>
            messageListeners.forEach((listener) =>
              listener({
                protocolVersion: 1,
                requestId: message.requestId,
                ok: true,
                result:
                  message.type === "list_shared_audits"
                    ? { snapshots: [], total: 0, offset: 0, limit: 50, nextOffset: null }
                    : { status: "ready" },
              }),
            ),
          );
        }),
        disconnect: vi.fn(),
      })),
    },
  };
  return { browser, permissions, addedListeners };
});

vi.mock("wxt/browser", () => ({ browser: harness.browser }));

function workbench() {
  return {
    [workbenchKey as symbol]: {
      preference: ref("system"),
      toast: vi.fn(),
      setPreference: vi.fn(),
      inspectionMode: ref("individual"),
      automaticAccessGranted: ref(false),
      setInspectionMode: vi.fn(),
      enableAutomaticChecks: vi.fn(),
      revokeAutomaticAccess: vi.fn(),
    },
  };
}

describe("MCP permission waiting state", () => {
  beforeEach(() => {
    harness.permissions.contains.mockReset().mockResolvedValue(false);
    harness.permissions.request.mockReset();
    harness.browser.runtime.connectNative.mockClear();
    harness.addedListeners.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps AI Integrations focused on the companion, shared audits, and privacy", async () => {
    const wrapper = mount(AIIntegrationsView, { global: { provide: workbench() } });
    await flushPromises();

    expect(wrapper.text()).toContain("Local MCP Companion");
    expect(wrapper.text()).toContain("Shared audits");
    expect(wrapper.text()).toContain("Privacy & access");
    expect(wrapper.text()).not.toContain("Supported AI assistants");
    expect(wrapper.text()).not.toContain("Claude Code");
    expect(wrapper.text()).not.toContain("Codex");
    wrapper.unmount();
  });

  it("leaves Settings usable and rechecks permission without starting another prompt", async () => {
    let resolveRequest!: (granted: boolean) => void;
    const request = new Promise<boolean>((resolve) => (resolveRequest = resolve));
    harness.permissions.request.mockReturnValue(request);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    const enable = wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing");
    await enable?.trigger("click");
    await vi.advanceTimersByTimeAsync(10_000);
    await flushPromises();

    expect(wrapper.text()).toContain("Approve or dismiss the browser prompt.");
    expect(wrapper.text()).toContain("Awaiting Permission");
    const recheck = wrapper
      .findAll("button")
      .find((button) => button.text() === "Check permission status");
    expect(recheck?.element.disabled).toBe(false);
    await recheck?.trigger("click");
    await flushPromises();

    expect(harness.permissions.request).toHaveBeenCalledTimes(1);
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();

    resolveRequest(false);
    await request;
    await Promise.resolve();
    wrapper.unmount();
  });

  it("continues the companion check when the browser grants permission before resolving request()", async () => {
    let resolveRequest!: (granted: boolean) => void;
    const request = new Promise<boolean>((resolve) => (resolveRequest = resolve));
    harness.permissions.request.mockReturnValue(request);
    const wrapper = mount(AIIntegrationsView, {
      global: { provide: workbench() },
    });
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Enable local sharing")
      ?.trigger("click");
    expect(wrapper.text()).toContain("Awaiting Permission");

    harness.permissions.contains.mockResolvedValue(true);
    harness.addedListeners.forEach((listener) => listener({ permissions: ["nativeMessaging"] }));
    await flushPromises();

    expect(harness.browser.runtime.connectNative).toHaveBeenCalledWith(
      "com.misoecosystem.rankmiso",
    );
    expect(wrapper.text()).toContain("Connected");
    resolveRequest(true);
    await flushPromises();
    wrapper.unmount();
  });

});
