import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const listeners = {
    message: [] as Array<(message: unknown) => void>,
    disconnect: [] as Array<() => void>,
    permissionAdded: [] as Array<(permissions: { permissions?: string[] }) => void>,
    permissionRemoved: [] as Array<(permissions: { permissions?: string[] }) => void>,
  };
  const browser = {
    permissions: {
      contains: vi.fn(async () => true),
      request: vi.fn(async () => true),
      onAdded: {
        addListener: (listener: (permissions: { permissions?: string[] }) => void) =>
          listeners.permissionAdded.push(listener),
        removeListener: (listener: (permissions: { permissions?: string[] }) => void) => {
          listeners.permissionAdded = listeners.permissionAdded.filter((item) => item !== listener);
        },
      },
      onRemoved: {
        addListener: (listener: (permissions: { permissions?: string[] }) => void) =>
          listeners.permissionRemoved.push(listener),
        removeListener: (listener: (permissions: { permissions?: string[] }) => void) => {
          listeners.permissionRemoved = listeners.permissionRemoved.filter(
            (item) => item !== listener,
          );
        },
      },
    },
    runtime: {
      lastError: undefined as { message?: string } | undefined,
      connectNative: vi.fn(() => ({
        onMessage: {
          addListener: (listener: (message: unknown) => void) => listeners.message.push(listener),
          removeListener: (listener: (message: unknown) => void) => {
            listeners.message = listeners.message.filter((item) => item !== listener);
          },
        },
        onDisconnect: {
          addListener: (listener: () => void) => listeners.disconnect.push(listener),
          removeListener: (listener: () => void) => {
            listeners.disconnect = listeners.disconnect.filter((item) => item !== listener);
          },
        },
        postMessage: vi.fn((message: { requestId: string; type?: string }) => {
          queueMicrotask(() =>
            listeners.message.forEach((listener) =>
              listener({
                protocolVersion: 1,
                requestId: message.requestId,
                ok: true,
                result:
                  message.type === "share_audit"
                    ? {
                        snapshot: {
                          snapshotId: "rankmiso-shared-123-0",
                          pageUrl: "https://example.test/",
                          pageTitle: "A test page",
                          analyzedAt: "2026-10-31T12:00:00Z",
                          sharedAtUnixMs: 1,
                          auditType: "audit",
                        },
                      }
                    : message.type === "list_shared_audits"
                      ? { snapshots: [], total: 0, offset: 0, limit: 50, nextOffset: null }
                      : message.type === "remove_shared_audit"
                        ? { removed: true }
                        : { status: "ready" },
              }),
            ),
          );
        }),
        disconnect: vi.fn(),
      })),
    },
  };
  return { browser, listeners };
});

vi.mock("wxt/browser", () => ({ browser: harness.browser }));

import {
  checkNativeCompanion,
  isNativeMessagingPermissionRequestPending,
  listSharedAudits,
  removeSharedAudit,
  requestNativeMessagingPermission,
  shareAudit,
} from "../src/services/mcp-native-bridge";

const audit = {
  schemaVersion: 1,
  analyzedAt: "2026-10-31T12:00:00Z",
  page: { url: "https://example.test/", title: "A test page", language: "en" },
} as never;

describe("RankMiso Native Messaging bridge", () => {
  beforeEach(() => {
    delete (
      harness.browser.runtime as typeof harness.browser.runtime & { getBrowserInfo?: unknown }
    ).getBrowserInfo;
    delete (
      harness.browser.permissions as typeof harness.browser.permissions & {
        getAll?: unknown;
      }
    ).getAll;
    harness.listeners.permissionRemoved.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );
    harness.browser.permissions.contains.mockReset().mockResolvedValue(true);
    harness.browser.permissions.request.mockReset().mockResolvedValue(true);
    harness.browser.runtime.lastError = undefined;
    harness.browser.runtime.connectNative.mockClear();
    harness.listeners.message = [];
    harness.listeners.disconnect = [];
    harness.listeners.permissionAdded = [];
    vi.stubGlobal("crypto", { randomUUID: () => "request-1" });
  });

  it("shares only after permission, using the existing audit JSON representation", async () => {
    const response = await shareAudit(audit);
    expect(harness.browser.permissions.contains).toHaveBeenCalledWith({
      permissions: ["nativeMessaging"],
    });
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledWith(
      "com.misoecosystem.rankmiso",
    );
    const port = harness.browser.runtime.connectNative.mock.results[0]?.value;
    expect(port?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolVersion: 1,
        requestId: "request-1",
        type: "share_audit",
        audit,
      }),
    );
    expect(response.snapshot.pageUrl).toBe("https://example.test/");
  });

  it("requires Firefox audit-data consent and requests it only from the user action", async () => {
    const runtime = harness.browser.runtime as typeof harness.browser.runtime & {
      getBrowserInfo?: () => Promise<unknown>;
    };
    const permissions = harness.browser.permissions as typeof harness.browser.permissions & {
      getAll?: () => Promise<{ data_collection?: string[] }>;
      request: (details: unknown) => Promise<boolean>;
    };
    runtime.getBrowserInfo = async () => ({ name: "Firefox" });
    permissions.getAll = vi.fn(async () => ({
      data_collection: ["browsingActivity", "websiteContent"],
    }));

    await expect(requestNativeMessagingPermission(true)).resolves.toBe(true);
    expect(permissions.request).toHaveBeenNthCalledWith(1, {
      permissions: ["nativeMessaging"],
    });
    expect(permissions.request).toHaveBeenNthCalledWith(2, {
      data_collection: ["browsingActivity", "websiteContent"],
    });
    expect(
      await (await import("../src/services/mcp-native-bridge")).hasSharedAuditDataPermission(),
    ).toBe(true);
  });

  it("does not share or read audits when Firefox audit-data consent is missing", async () => {
    const runtime = harness.browser.runtime as typeof harness.browser.runtime & {
      getBrowserInfo?: () => Promise<unknown>;
    };
    const permissions = harness.browser.permissions as typeof harness.browser.permissions & {
      getAll?: () => Promise<{ data_collection?: string[] }>;
    };
    runtime.getBrowserInfo = async () => ({ name: "Firefox" });
    permissions.getAll = vi.fn(async () => ({ data_collection: [] }));

    await expect(shareAudit(audit)).rejects.toMatchObject({ code: "permission-required" });
    await expect(listSharedAudits()).rejects.toMatchObject({ code: "permission-required" });
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
  });

  it("uses Chrome's native runtime when the browser alias omits connectNative", async () => {
    const browserRuntime = harness.browser.runtime as typeof harness.browser.runtime & {
      connectNative?: typeof harness.browser.runtime.connectNative;
    };
    const createPort = browserRuntime.connectNative!;
    Object.defineProperty(browserRuntime, "connectNative", {
      configurable: true,
      value: undefined,
    });
    const chromeConnectNative = vi.fn(createPort);
    vi.stubGlobal("chrome", {
      runtime: { connectNative: chromeConnectNative, lastError: undefined },
    });

    try {
      await expect(checkNativeCompanion()).resolves.toBe(true);
      expect(chromeConnectNative).toHaveBeenCalledWith("com.misoecosystem.rankmiso");
    } finally {
      browserRuntime.connectNative = createPort;
      vi.unstubAllGlobals();
    }
  });

  it("reloads Chrome when its live context has not bound optional Native Messaging yet", async () => {
    const browserRuntime = harness.browser.runtime as typeof harness.browser.runtime & {
      connectNative?: typeof harness.browser.runtime.connectNative;
    };
    const createPort = browserRuntime.connectNative!;
    Object.defineProperty(browserRuntime, "connectNative", {
      configurable: true,
      value: undefined,
    });
    const reload = vi.fn();
    vi.stubGlobal("chrome", { runtime: { reload } });

    try {
      await expect(checkNativeCompanion()).rejects.toMatchObject({
        code: "connection-failed",
        message: expect.stringContaining("Chrome is reloading RankMiso"),
      });
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      browserRuntime.connectNative = createPort;
      vi.unstubAllGlobals();
    }
  });

  it("blocks access when permission is absent", async () => {
    harness.browser.permissions.contains.mockResolvedValue(false);
    await expect(checkNativeCompanion()).rejects.toThrow("permission is not enabled");
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
  });

  it("reports a pending permission decision without treating it as denial or prompting twice", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (granted: boolean) => void;
    const request = new Promise<boolean>((resolve) => (resolveRequest = resolve));
    harness.browser.permissions.request.mockReturnValueOnce(request);

    try {
      const firstRequest = requestNativeMessagingPermission();
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(firstRequest).resolves.toBeNull();
      expect(isNativeMessagingPermissionRequestPending()).toBe(true);
      await expect(requestNativeMessagingPermission()).resolves.toBeNull();
      expect(harness.browser.permissions.request).toHaveBeenCalledTimes(1);

      resolveRequest(true);
      await request;
      await Promise.resolve();
      expect(isNativeMessagingPermissionRequestPending()).toBe(false);
      await expect(requestNativeMessagingPermission()).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("continues as soon as the browser reports the grant even if request() is still pending", async () => {
    let resolveRequest!: (granted: boolean) => void;
    const request = new Promise<boolean>((resolve) => (resolveRequest = resolve));
    harness.browser.permissions.request.mockReturnValueOnce(request);

    const permission = requestNativeMessagingPermission();
    expect(isNativeMessagingPermissionRequestPending()).toBe(true);
    harness.listeners.permissionAdded.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );

    await expect(permission).resolves.toBe(true);
    expect(isNativeMessagingPermissionRequestPending()).toBe(false);
    resolveRequest(true);
    await request;
  });

  it("identifies a missing browser registration separately from host failures", async () => {
    const disconnectListeners: Array<() => void> = [];
    const port = {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: {
        addListener: vi.fn((listener: () => void) => disconnectListeners.push(listener)),
        removeListener: vi.fn(),
      },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    };
    harness.browser.runtime.connectNative.mockReturnValueOnce(port);
    harness.browser.runtime.lastError = { message: "Specified native messaging host not found." };
    const pending = checkNativeCompanion();
    await vi.waitFor(() => expect(disconnectListeners).toHaveLength(1));
    disconnectListeners[0]!();

    await expect(pending).rejects.toMatchObject({ code: "not-installed" });
    harness.browser.runtime.lastError = undefined;
  });

  it("preserves a synchronous native-host startup error for the Settings UI", async () => {
    harness.browser.runtime.connectNative.mockImplementationOnce(() => {
      throw new Error("Access to the specified native messaging host is forbidden.");
    });

    await expect(checkNativeCompanion()).rejects.toMatchObject({
      code: "not-installed",
      message:
        "The local companion could not be started: Access to the specified native messaging host is forbidden.",
    });
  });

  it("deduplicates recent companion and shared-list checks, then invalidates after a share", async () => {
    await Promise.all([checkNativeCompanion(), checkNativeCompanion()]);
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledOnce();
    await checkNativeCompanion();
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledOnce();

    await listSharedAudits();
    await listSharedAudits();
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledTimes(2);

    await shareAudit(audit);
    await listSharedAudits();
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledTimes(4);
  });

  it("invalidates the short-lived connection cache when permission is revoked", async () => {
    await checkNativeCompanion();
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledOnce();

    harness.listeners.permissionRemoved.forEach((listener) =>
      listener({ permissions: ["nativeMessaging"] }),
    );
    await checkNativeCompanion();
    expect(harness.browser.runtime.connectNative).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized audit without truncating or opening the native host", async () => {
    const oversizedAudit = { ...(audit as object), oversized: "x".repeat(900 * 1024) };
    await expect(shareAudit(oversizedAudit as never)).rejects.toThrow(
      "too large to share through Native Messaging. Use the JSON export instead.",
    );
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
  });

  it("rejects malformed companion response data", async () => {
    const port = harness.browser.runtime.connectNative.getMockImplementation();
    harness.browser.runtime.connectNative.mockImplementation(() => {
      const value = port?.();
      if (value)
        value.postMessage = vi.fn((message: { requestId: string }) => {
          queueMicrotask(() =>
            harness.listeners.message.forEach((listener) =>
              listener({
                protocolVersion: 1,
                requestId: message.requestId,
                ok: true,
                result: { snapshots: [{ snapshotId: "../../etc/passwd" }] },
              }),
            ),
          );
        });
      return value!;
    });
    await expect(listSharedAudits()).rejects.toThrow("invalid shared-audit list");
  });

  it("validates snapshot IDs before requesting deletion", async () => {
    await expect(removeSharedAudit("../../etc/passwd")).rejects.toThrow(
      "Invalid shared audit identifier",
    );
    expect(harness.browser.runtime.connectNative).not.toHaveBeenCalled();
  });
});
